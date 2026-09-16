export const APPLICATION_STATUSES = ["Saved", "Applied", "Shortlisted", "Interview", "Offer", "Rejected", "Withdrawn"];

export const APPLICATION_TRANSITIONS = {
  Saved: ["Saved", "Applied", "Withdrawn"],
  Applied: ["Applied", "Shortlisted", "Rejected", "Withdrawn"],
  Shortlisted: ["Shortlisted", "Interview", "Rejected", "Withdrawn"],
  Interview: ["Interview", "Offer", "Rejected", "Withdrawn"],
  Offer: ["Offer", "Withdrawn"],
  Rejected: ["Rejected"],
  Withdrawn: ["Withdrawn"],
};

export const ACTIVITY_TYPES = ["view", "save", "apply", "follow", "profile_update", "search"];

export const ORGANIZATION_ROLES = ["organization"];
