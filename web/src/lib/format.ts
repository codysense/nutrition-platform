import { ReviewStatus, Role } from './types';

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  DRAFT: 'Draft', PENDING_REVIEW: 'Pending review', APPROVED: 'Approved', PUBLISHED: 'Published',
  REJECTED: 'Rejected', ARCHIVED: 'Archived', REQUIRES_UPDATE: 'Needs update',
};

export const STATUS_STYLE: Record<ReviewStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700', PENDING_REVIEW: 'bg-amber-100 text-amber-800', APPROVED: 'bg-emerald-100 text-emerald-800',
  PUBLISHED: 'bg-green-200 text-green-900', REJECTED: 'bg-red-100 text-red-800', ARCHIVED: 'bg-zinc-200 text-zinc-600',
  REQUIRES_UPDATE: 'bg-orange-100 text-orange-800',
};

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super admin', CONTENT_MANAGER: 'Content manager', NUTRITION_REVIEWER: 'Dietitian', VIEWER: 'Viewer',
};

export const titleCase = (s: string | null | undefined) =>
  s ? s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '';

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const DISH_CATEGORIES = [
  'Breakfast / Porridge', 'Drink', 'Grill / Protein', 'Main dish', 'Rice dish', 'Snack / Side', 'Soup / Stew', 'Swallow', 'Swallow & Soup',
];
export const CUISINES = ['Pan-Nigerian', 'Yoruba', 'Igbo', 'Hausa', 'Efik / Ibibio', 'Urhobo / Isoko', 'Other'];
export const FOOD_CATEGORIES = [
  'Leafy vegetables', 'Other vegetables', 'Fruits', 'Grains & cereals', 'Tubers & roots', 'Legumes & beans', 'Nuts & seeds',
  'Meat & poultry', 'Fish & seafood', 'Dairy & eggs', 'Oils & fats', 'Herbs, spices & seasonings', 'Fermented seasonings',
  'Processed foods & staples',
];
export const STATUSES = Object.keys(STATUS_LABEL) as ReviewStatus[];
