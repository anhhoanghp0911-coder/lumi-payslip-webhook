// Đọc số tiền thành chữ tiếng Việt (dùng cho dòng "Bằng chữ" trên phiếu lương)
const ONES = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function readThree(n, full) {
  const tram = Math.floor(n / 100);
  const chuc = Math.floor((n % 100) / 10);
  const donvi = n % 10;
  let s = '';
  if (full || tram > 0) s += ONES[tram] + ' trăm';
  if (chuc === 0) {
    if (donvi > 0) {
      if (tram > 0 || full) s += ' lẻ';
      s += ' ' + ONES[donvi];
    }
  } else if (chuc === 1) {
    s += ' mười';
    if (donvi === 5) s += ' lăm';
    else if (donvi > 0) s += ' ' + ONES[donvi];
  } else {
    s += ' ' + ONES[chuc] + ' mươi';
    if (donvi === 1) s += ' mốt';
    else if (donvi === 5) s += ' lăm';
    else if (donvi > 0) s += ' ' + ONES[donvi];
  }
  return s.trim();
}

function numToWords(num) {
  num = Math.round(Number(num) || 0);
  if (num === 0) return 'Không đồng';
  const units = ['', ' nghìn', ' triệu', ' tỷ'];
  const groups = [];
  let n = num;
  while (n > 0) {
    groups.unshift(n % 1000);
    n = Math.floor(n / 1000);
  }
  const len = groups.length;
  const parts = [];
  for (let i = 0; i < len; i++) {
    const g = groups[i];
    const unitIdx = (len - 1 - i) % 4;
    if (g === 0) continue;
    parts.push(readThree(g, i > 0) + units[unitIdx]);
  }
  let s = parts.join(' ').replace(/\s+/g, ' ').trim();
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return s + ' đồng';
}

module.exports = { numToWords };
