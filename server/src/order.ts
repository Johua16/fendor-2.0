// Pure domain rules: callers must load actor identity and order data from trusted storage.
export type OrderState = 'draft' | 'checking_availability' | 'reserved' | 'awaiting_payment' | 'confirmed' | 'preparing' | 'ready_for_dispatch' | 'out_for_delivery' | 'delivered' | 'unavailable' | 'cancelled';
export type Actor = { id: string; role: 'customer' | 'vendor' | 'admin' };
export type Order = {
  id: string; customerId: string; vendorId: string; productVariantId: string;
  quantity: number; state: OrderState; version: number;
  reservationExpiresAt?: number; totalKobo?: number; acceptedTotalKobo?: number;
  paymentVerified?: boolean;
};
export type Command =
  | { type: 'submit' }
  | { type: 'reserve'; expiresAt: number }
  | { type: 'decline' }
  | { type: 'quote'; totalKobo: number }
  | { type: 'accept_quote'; totalKobo: number }
  | { type: 'verify_payment'; receivedKobo: number }
  | { type: 'prepare' } | { type: 'ready' } | { type: 'dispatch' }
  | { type: 'deliver' } | { type: 'cancel' };
export class DomainError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}
function requireCondition(value: unknown, code: string, message: string): asserts value {
  if (!value) throw new DomainError(code, message);
}
export function transition(order: Order, actor: Actor, command: Command, now: number): Order {
  requireCondition(Number.isFinite(now), 'INVALID_TIME', 'A valid server timestamp is required.');
  requireCondition(Number.isSafeInteger(order.quantity) && order.quantity > 0, 'INVALID_QUANTITY', 'Quantity must be a positive integer.');
  const next = { ...order, version: order.version + 1 };
  const role = (required: Actor['role']) => requireCondition(
    actor.role === required && (required === 'admin' || actor.id === (required === 'customer' ? order.customerId : order.vendorId)),
    'FORBIDDEN', 'This actor cannot perform this action on this order.');
  const state = (...allowed: OrderState[]) => requireCondition(allowed.includes(order.state), 'INVALID_STATE', 'This action is unavailable in the current order state.');
  const active = () => requireCondition(order.reservationExpiresAt !== undefined && order.reservationExpiresAt > now, 'RESERVATION_EXPIRED', 'Reconfirm availability before continuing.');
  const money = (value: number) => requireCondition(Number.isSafeInteger(value) && value > 0, 'INVALID_AMOUNT', 'Amount must be a positive integer in kobo.');
  switch (command.type) {
    case 'submit': role('customer'); state('draft'); next.state = 'checking_availability'; break;
    case 'reserve':
      role('vendor'); state('checking_availability', 'reserved', 'awaiting_payment');
      requireCondition(Number.isSafeInteger(command.expiresAt) && command.expiresAt > now, 'INVALID_EXPIRY', 'Reservation expiry must be in the future.');
      next.state = 'reserved'; next.reservationExpiresAt = command.expiresAt;
      // Renewed availability requires a fresh quote and customer acceptance.
      delete next.totalKobo; delete next.acceptedTotalKobo;
      break;
    case 'decline': role('vendor'); state('checking_availability', 'reserved', 'awaiting_payment'); next.state = 'unavailable'; break;
    case 'quote':
      role('admin'); state('reserved', 'awaiting_payment'); active(); money(command.totalKobo);
      next.totalKobo = command.totalKobo; delete next.acceptedTotalKobo; next.state = 'reserved'; break;
    case 'accept_quote':
      role('customer'); state('reserved'); active(); money(command.totalKobo);
      requireCondition(command.totalKobo === order.totalKobo, 'QUOTE_CHANGED', 'Review the latest total.');
      next.acceptedTotalKobo = command.totalKobo; next.state = 'awaiting_payment'; break;
    case 'verify_payment':
      role('admin'); state('awaiting_payment'); active(); money(command.receivedKobo);
      requireCondition(order.totalKobo === order.acceptedTotalKobo && command.receivedKobo === order.totalKobo, 'PAYMENT_MISMATCH', 'Resolve the payment discrepancy before confirming.');
      next.paymentVerified = true; next.state = 'confirmed'; break;
    case 'prepare':
      role('vendor'); state('confirmed');
      requireCondition(order.paymentVerified === true, 'PAYMENT_REQUIRED', 'Fendor must verify payment first.');
      next.state = 'preparing'; break;
    case 'ready': role('vendor'); state('preparing'); next.state = 'ready_for_dispatch'; break;
    case 'dispatch': role('admin'); state('ready_for_dispatch'); next.state = 'out_for_delivery'; break;
    case 'deliver': role('admin'); state('out_for_delivery'); next.state = 'delivered'; break;
    case 'cancel':
      role('customer'); state('draft', 'checking_availability', 'reserved', 'awaiting_payment', 'unavailable');
      requireCondition(!order.paymentVerified, 'REMEDY_REQUIRED', 'Paid orders require a reviewed cancellation or refund.');
      next.state = 'cancelled'; break;
    default: throw new DomainError('UNKNOWN_COMMAND', 'Unsupported order action.');
  }
  return next;
}
