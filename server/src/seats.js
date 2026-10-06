export function buildSeats({ eventId, rows, perRow, vipRows, price, vipPrice }) {
  const seats = [];
  for (let r = 0; r < rows; r++) {
    const rowLetter = String.fromCharCode(65 + r); // 65 = "A"
    const isVip = r < vipRows;
    for (let n = 1; n <= perRow; n++) {
      seats.push({
        eventId,
        label: `${rowLetter}${n}`,
        row: rowLetter,
        number: n,
        tier: isVip ? "VIP" : "REGULAR",
        price: isVip ? vipPrice : price,
      });
    }
  }
  return seats;
}