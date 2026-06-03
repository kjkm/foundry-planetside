const DEG = Math.PI / 180;

export class Mercator {
  constructor({ maxLatitudeDeg = 85 } = {}) {
    this.maxLat = maxLatitudeDeg * DEG;
    this.yMax = Math.log(Math.tan(Math.PI / 4 + this.maxLat / 2));
  }

  latLonToUv(lat, lon) {
    const u = (lon + Math.PI) / (2 * Math.PI);
    const clampedLat = Math.max(-this.maxLat, Math.min(this.maxLat, lat));
    const yMerc = Math.log(Math.tan(Math.PI / 4 + clampedLat / 2));
    const v = 0.5 - 0.5 * (yMerc / this.yMax);
    return { u, v };
  }

  uvToLatLon(u, v) {
    const lon = u * 2 * Math.PI - Math.PI;
    const yMerc = (0.5 - v) * 2 * this.yMax;
    const lat = 2 * Math.atan(Math.exp(yMerc)) - Math.PI / 2;
    return { lat, lon };
  }

  spherePointToLatLon(point) {
    const r = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z) || 1;
    const lat = Math.asin(point.y / r);
    const lon = Math.atan2(point.x, point.z);
    return { lat, lon };
  }

  latLonToSpherePoint(lat, lon, radius = 1) {
    return {
      x: radius * Math.cos(lat) * Math.sin(lon),
      y: radius * Math.sin(lat),
      z: radius * Math.cos(lat) * Math.cos(lon)
    };
  }

  isLatitudeOnBody(lat) {
    return Math.abs(lat) <= this.maxLat;
  }
}
