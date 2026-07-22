export const getCurrentFormattedDate = () => {
  const now = new Date();

  const year = now.getFullYear();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");

  return `${year}-${day}-${month}-${hours}`;
};
