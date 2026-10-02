export const DEFAULT_ASSISTANTS = [
  { 
    name: "Assistant 1 (West Patna)", 
    hq: "Bihta", 
    district: "Patna", 
    target: 116,
    blocks: ["Bihta", "Maner", "Bikram", "Naubatpur", "Danapur"],
    color: "#16a34a",
    password: "rep123"
  },
  { 
    name: "Assistant 2 (Central/South Patna)", 
    hq: "Phulwari Sharif", 
    district: "Patna", 
    target: 103,
    blocks: ["Phulwari Sharif", "Masaurhi", "Punpun", "Dhanarua", "Sampatchak"],
    color: "#0284c7",
    password: "rep123"
  },
  { 
    name: "Assistant 3 (East Patna)", 
    hq: "Bakhtiarpur", 
    district: "Patna", 
    target: 80,
    blocks: ["Bakhtiarpur", "Barh", "Mokama", "Fatuha", "Daniyawan", "Pandarak"],
    color: "#9333ea",
    password: "rep123"
  },
  { 
    name: "Assistant 4 (West Vaishali)", 
    hq: "Hajipur", 
    district: "Vaishali", 
    target: 99,
    blocks: ["Hajipur", "Lalganj", "Vaishali", "Bhagwanpur", "Garaul"],
    color: "#d97706",
    password: "rep123"
  },
  { 
    name: "Assistant 5 (East Vaishali)", 
    hq: "Mahua", 
    district: "Vaishali", 
    target: 79,
    blocks: ["Mahua", "Jandaha", "Patepur", "Bidupur", "Desri", "Rajapakar"],
    color: "#0d9488",
    password: "rep123"
  },
  { 
    name: "Assistant 6 (Rohtas)", 
    hq: "Sasaram", 
    district: "Rohtas", 
    target: 66,
    blocks: ["Sasaram", "Dehri", "Nokha", "Karakat", "Bikramganj", "Sheosagar"],
    color: "#ea580c",
    password: "rep123"
  },
  { 
    name: "Assistant 7 (Kaimur)", 
    hq: "Bhabua", 
    district: "Kaimur", 
    target: 7,
    blocks: ["Bhabua", "Mohania", "Kudra", "Chainpur"],
    color: "#dc2626",
    password: "rep123"
  },
  { 
    name: "Assistant 8 (Bhojpur & Buxar)", 
    hq: "Behea", 
    district: "Bhojpur", 
    target: 23,
    blocks: ["Behea", "Jagdishpur", "Arrah", "Buxar", "Dumraon"],
    color: "#4f46e5",
    password: "rep123"
  },
];

export const ASSISTANTS = DEFAULT_ASSISTANTS;

export const POTENTIAL_FOR = ["Veg", "CP", "Field", "Multi"];
export const POTENTIAL_SELL = ["5000-10000", "10000-15000", "15000-20000", ">20000"];

export const STATUS_OPTIONS = [
  { id: "Pending", label: "Pending", badge: "badge-pending", icon: "⏳" },
  { id: "Called", label: "Call Done", badge: "badge-called", icon: "📞" },
  { id: "Visited", label: "Visited", badge: "badge-visited", icon: "🚜" },
  { id: "Closed", label: "Order Booked", badge: "badge-closed", icon: "✅" },
  { id: "Followup", label: "Follow-up", badge: "badge-followup", icon: "🔄" },
];
