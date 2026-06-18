// config/admins.ts
// لیست آیدی کاربرانی که ادمین هستند (آیدی خودت رو وارد کن)
export const ADMIN_IDS = [
  'bd47c7fd-14c5-48ce-87c8-232ec90cfec4', // آیدی ادمین اصلی
  // میتونی آیدی های دیگه هم اضافه کنی
];

export const isUserAdmin = (userId: string | undefined) => {
  if (!userId) return false;
  return ADMIN_IDS.includes(userId);
};