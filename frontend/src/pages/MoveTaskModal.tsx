import { Modal } from '../components/Modal';

interface EligibleParent {
  id: string;
  title: string;
  description?: string | null;
}

interface MoveTaskModalProps {
  open: boolean;
  onClose: () => void;
  eligibleParents: EligibleParent[];
  onSelect: (parentId: string) => void;
  loading?: boolean;
}

export function MoveTaskModal({
  open,
  onClose,
  eligibleParents,
  onSelect,
  loading = false,
}: MoveTaskModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Move under...">
      {eligibleParents.length === 0 ? (
        <p className="text-sm text-gray-400">No eligible tasks.</p>
      ) : (
        <ul className="space-y-1 max-h-80 overflow-y-auto">
          {eligibleParents.map((parent) => (
            <li key={parent.id}>
              <button
                onClick={() => onSelect(parent.id)}
                disabled={loading}
                className="w-full text-left rounded-lg border p-3 hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50"
              >
                <p className="font-medium text-gray-900">{parent.title}</p>
                {parent.description && (
                  <p className="mt-0.5 text-sm text-gray-500">{parent.description}</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
