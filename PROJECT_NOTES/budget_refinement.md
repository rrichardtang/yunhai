Budget Optimization flow

This should live in the Budget Lens bar.

1. User clicks "Optimize" button
2. Takes user to Review step and All approved activity cards get a clean lift animation. Keep the search and city filter, everything else goes. I want the background to be darkened.
3. User scrolls through and chooses which activities to lock. There should be golden lock icon at the top right of each card. When pressed, that activity is considered locked.
4. User clicks Confirm
5. Refine endpoint is called with only the unlocked activities and their information
6. Each unlocked activity gets a refined alternative
7. The user sees each refined alternative through a turn around button at the top right of the card (where the lock icon was):
  • front side = new refinement
  • backside = previous/original card
8. The user flips each card to the option they like
  • the card facing the screen is the selected choice
9. A progress bar at the bottom shows:
  • 100% = total estimated cost of all activities
  • Progress = sum of locked activities + sum of chosen activities from the refined unlocked pool
10. User clicks Confirm
11. The selected cards are put back into the Review step and the Budget Lens total is updated
12. The view returns to the original Review Activities state

Refinement request rules

• Locked cards are not sent for refinement
• No lock status needs to be sent in the payload because locked cards are excluded entirely
• The refine call should receive:
  • total sum of unlocked activities
  • information for each unlocked activity

UX intent

• The user is deciding which activities stay fixed and which are optimized
• The refinement process should be visual and low-friction
• The user should always understand how the selected combination affects the final total
• The selected card facing the screen is the active choice

Implementation intent

• Reuse the existing refine path where practical
• Keep the optimization experience as a review-step augmentation
• Preserve the current organizer hierarchy and Budget Lens behavior
• Keep the progress bar tied to the full activity total, while only counting locked + chosen optimized items toward progress