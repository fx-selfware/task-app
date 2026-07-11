import { ImageResponse } from 'next/og';
import { iconMark } from '../icon-mark';

export const dynamic = 'force-static';

export async function GET() {
  return new ImageResponse(iconMark(2), { width: 512, height: 512 });
}
