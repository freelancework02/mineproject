export const LEAD_STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "interested", label: "Interested" },
  { value: "follow_up", label: "Follow Up" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" }
];

export const LEAD_STATUS_VALUES = LEAD_STATUS_OPTIONS.map((status) => status.value);

export const LEAD_SORT_FIELDS = {
  created_at: "created_at",
  name: "name",
  status: "status",
  source: "source"
};
