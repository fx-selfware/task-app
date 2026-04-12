# Incident Report: Production App Unreachable

**Date:** 2026-04-12
**Duration:** Unknown start (estimated Apr 12 early morning) to Apr 12 resolution
**Severity:** Full outage -- app unreachable from external network
**Environment:** Azure VM `task-app-vm` (Standard_B1s, 1 GiB RAM), West US 2

## Summary

The production app became unreachable from the internet. The Azure VM was running and all Docker containers were healthy, but external HTTP/HTTPS connections timed out. Internal connectivity (`curl localhost`) worked fine.

## Timeline

| Time | Event |
|---|---|
| Feb 23 | VM provisioned (Standard_B1s, 1 GiB RAM, no swap) |
| Mar 16 | Last deployment (all CI/CD passed) -- app working normally |
| Apr 4 | `unattended-upgrades` installs linux-tools update |
| Apr 10 06:23 | `unattended-upgrades` installs `libssl3t64` and `openssl` update; triggers `fwupd` restart |
| Apr 10 10:17 | `fwupd` OOM-killed for the first time |
| Apr 10 10:35 | `fwupd` fails to restart (killed again) |
| Apr 10 11:32 | `fwupd` restarts successfully, stays running |
| Apr 11 08:03 | `fwupd` OOM-killed again |
| Apr 12 02:08 | `apt-daily` runs `apt-check` (~100 MiB RSS) -- OOM-killed |
| Apr 12 16:32 | `apt-check` OOM-killed again, invoked by `containerd-shim` -- external connectivity breaks |
| Apr 12 ~17:00 | Issue reported; investigation begins |
| Apr 12 ~17:30 | Swap file added, Caddy restarted -- app restored |

## Root Cause

The VM (Standard_B1s) has only 1 GiB RAM and was configured with no swap. Total memory usage by Docker containers was low (~79 MiB), but host OS services consumed ~600+ MiB (Azure agents, containerd, systemd, Python daemons, etc.), leaving minimal headroom.

On April 10, `unattended-upgrades` installed an OpenSSL update which triggered restarts of `fwupd` (firmware update daemon). `fwupd` was repeatedly OOM-killed and restarted over the following days, creating memory pressure spikes. On April 12, the combination of `fwupd` and `apt-daily` running `apt-check` (~100 MiB) exhausted remaining memory. The kernel OOM-killed `apt-check` but the system was left in a state where there was insufficient kernel memory to handle external TCP connections (NAT/conntrack), while localhost connections (which bypass this path) continued to work.

## Diagnosis Steps

1. Confirmed Azure VM was running and NSG rules allowed ports 22/80/443
2. HTTP/HTTPS curl to VM IP timed out
3. Used `az vm run-command` to inspect the VM remotely:
   - All 4 Docker containers (caddy, frontend, backend, db) were up and healthy
   - `curl localhost:80` returned HTTP 308 (working internally)
   - Disk was fine (32% used)
   - Memory critically low: 764 MiB used / 848 MiB total, 83 MiB available, no swap
   - `dmesg` showed repeated OOM kills
   - `apt` history showed the April 10 OpenSSL upgrade as the triggering event
   - Per-container memory via `docker stats`: only ~79 MiB total (no container leak)

## Resolution

1. Added a 256 MiB swap file (`/swapfile`) with persistent mount via `/etc/fstab`
2. Restarted the Caddy container to restore external connectivity

## Follow-up Actions

- [ ] Consider disabling `fwupd` service -- it is unnecessary on a VM and contributed to OOM pressure
- [ ] Consider disabling `unattended-upgrades` or scheduling manual update windows
- [ ] Evaluate upgrading to Standard_B1ms (2 GiB RAM, ~$7.50/month more) for proper headroom
- [ ] Monitor memory usage periodically (e.g., set up an Azure alert on memory percentage)
