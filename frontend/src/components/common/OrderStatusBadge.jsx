import { useTranslation } from 'react-i18next';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-blue-100 text-blue-800',
  preparing: 'bg-indigo-100 text-indigo-800',
  ready: 'bg-teal-100 text-teal-800',
  picked_up: 'bg-purple-100 text-purple-800',
  delivered: 'bg-teal-100 text-teal-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  disputed: 'bg-orange-100 text-orange-800',
  refunded: 'bg-gray-100 text-gray-800',
};

export default function OrderStatusBadge({ status }) {
  const { t } = useTranslation();
  const label = t(`orders.status_${status}`, { defaultValue: status });
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}`}>
      {label}
    </span>
  );
}
