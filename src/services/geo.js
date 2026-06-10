function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function activityCoords(activity) {
  const rawLat = activity?.location?.lat;
  const rawLng = activity?.location?.lng;
  if (rawLat != null && rawLng != null) {
    const lat = Number(rawLat);
    const lng = Number(rawLng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) return { lat, lng };
  }
  const rawSLat = activity?.start_latitude;
  const rawSLng = activity?.start_longitude;
  if (rawSLat != null && rawSLng != null) {
    const sLat = Number(rawSLat);
    const sLng = Number(rawSLng);
    if (Number.isFinite(sLat) && Number.isFinite(sLng) && (sLat !== 0 || sLng !== 0)) return { lat: sLat, lng: sLng };
  }
  return null;
}

module.exports = { haversineKm, activityCoords };
