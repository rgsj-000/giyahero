export type TravelPackage = {
  id: string;
  name: string;
  agency: string;
  image: string;
  price: number;
  destinations: string[];
  duration: string;
  transport: string;
  match: number;
};

// Sample content from the approved mockup, not live agency inventory.
export const packages: TravelPackage[] = [
  {
    id: "grand-loop",
    name: "Quezon Grand Loop",
    agency: "Lakbay Quezon Tours",
    image: "river",
    price: 3595,
    destinations: [
      "Lucban",
      "Tayabas",
      "Pagbilao",
      "Mauban",
      "Cagbalete Island",
    ],
    duration: "3 days, 2 nights",
    transport: "Van from Tayabas and boat transfer",
    match: 94,
  },
  {
    id: "island-escape",
    name: "Cagbalete Island Escape",
    agency: "Cagbalete Escapes",
    image: "beach",
    price: 3114,
    destinations: ["Mauban", "Cagbalete Island"],
    duration: "3 days, 2 nights",
    transport: "Boat from Mauban port",
    match: 88,
  },
  {
    id: "heritage",
    name: "Heritage and Flavors of Lucban and Tayabas",
    agency: "Lakbay Quezon Tours",
    image: "lucban",
    price: 2250,
    destinations: ["Lucban", "Tayabas"],
    duration: "2 days, 1 night",
    transport: "Air-conditioned van",
    match: 86,
  },
  {
    id: "coast",
    name: "Guinayangan Falls and Coast Adventure",
    agency: "Quezon Coastal Tours",
    image: "bay",
    price: 2850,
    destinations: ["Guinayangan", "Mauban"],
    duration: "2 days, 1 night",
    transport: "Van and local transfers",
    match: 82,
  },
];

export function findPackages(destination: string, budget: number) {
  const query = destination.toLowerCase().trim();
  return packages.filter(
    (item) =>
      (!query ||
        [item.name, item.agency, ...item.destinations].some((value) =>
          value.toLowerCase().includes(query),
        )) &&
      (!budget || item.price <= budget),
  );
}

export function quoteTotal(
  item: TravelPackage,
  adults: number,
  children: number,
) {
  return item.price * (adults + children);
}

export function validateTrip(start: string, end: string, travelers: number) {
  if (!start || !end) return "Choose your departure and return dates.";
  if (end < start)
    return "Your return date must be on or after your departure.";
  if (travelers < 1) return "Add at least one traveler.";
  return "";
}

export const peso = (amount: number) => `₱${amount.toLocaleString("en-PH")}`;
