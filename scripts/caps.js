export function samplePerimeterAverageColor(pixelBuffer, width, height) {
  if (!pixelBuffer || pixelBuffer.length < 4) return { r: 0, g: 0, b: 0 };

  let rSum = 0, gSum = 0, bSum = 0, count = 0;

  const sampleRow = (row) => {
    const rowStart = row * width * 4;
    for (let x = 0; x < width; x++) {
      const i = rowStart + x * 4;
      rSum += pixelBuffer[i];
      gSum += pixelBuffer[i + 1];
      bSum += pixelBuffer[i + 2];
      count++;
    }
  };

  const sampleCol = (col) => {
    for (let y = 0; y < height; y++) {
      const i = (y * width + col) * 4;
      rSum += pixelBuffer[i];
      gSum += pixelBuffer[i + 1];
      bSum += pixelBuffer[i + 2];
      count++;
    }
  };

  sampleRow(0);
  sampleRow(height - 1);
  sampleCol(0);
  sampleCol(width - 1);

  if (count === 0) return { r: 0, g: 0, b: 0 };
  return {
    r: rSum / count / 255,
    g: gSum / count / 255,
    b: bSum / count / 255
  };
}
