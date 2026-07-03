function activityLocationLabel(activity, day) {
  return activity?.location?.address
    || activity?.venue_name
    || [activity?.start_location, activity?.end_location].filter(Boolean).join(' → ')
    || day?.city
    || '';
}

module.exports = { activityLocationLabel };
