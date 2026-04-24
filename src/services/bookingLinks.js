function buildBookingLinks({ bookingType, name, city, date = '', travelers = 0, children = 0 }) {
  const q = encodeURIComponent(name);
  const qCity = encodeURIComponent(`${name} ${city}`);
  const dateFrom = date ? `&date_from=${date}` : '';
  const startDate = date ? `&startDate=${date}` : '';
  const adults = travelers ? `&adults=${travelers}` : '';
  const kids = children ? `&children=${children}` : '';

  if (bookingType === 'tour') {
    return [
      { site: 'GetYourGuide', url: `https://www.getyourguide.com/s/?q=${q}${dateFrom}${adults}${kids}` },
      { site: 'Viator', url: `https://www.viator.com/searchResults/all?text=${q}${startDate}${adults}${kids}` }
    ];
  }
  if (bookingType === 'attraction') {
    return [{ site: 'Tickets', url: `https://www.google.com/search?q=${qCity}+tickets` }];
  }
  if (bookingType === 'restaurant') {
    return [{ site: 'Google Maps', url: `https://www.google.com/maps/search/${qCity}` }];
  }
  return [];
}

module.exports = { buildBookingLinks };
