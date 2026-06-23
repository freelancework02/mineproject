export const TASK_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" }
];

export const TASK_STATUS_VALUES = TASK_STATUS_OPTIONS.map((status) => status.value);

export const TASK_TYPE_OPTIONS = [
  { value: "call_customer", label: "Call Customer" },
  { value: "follow_up", label: "Follow Up" },
  { value: "send_email", label: "Send Email" },
  { value: "meeting", label: "Meeting" }
];

export const TASK_TYPE_VALUES = TASK_TYPE_OPTIONS.map((type) => type.value);
