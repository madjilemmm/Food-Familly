/** Les 10 recettes ajoutées à chaque nouvelle famille (à remplacer par les siennes). */
export const STARTER_RECIPES: {
  title: string;
  emoji: string;
  ingredients: { name: string; quantity: number | null; unit: string; aisle: string }[];
}[] = [
  {
    title: "Blanquette de veau",
    emoji: "🍲",
    ingredients: [
      { name: "Épaule de veau", quantity: 1.2, unit: "kg", aisle: "boucherie" },
      { name: "Carottes", quantity: 4, unit: "", aisle: "fruits_legumes" },
      { name: "Oignon", quantity: 1, unit: "", aisle: "fruits_legumes" },
      { name: "Champignons de Paris", quantity: 250, unit: "g", aisle: "fruits_legumes" },
      { name: "Crème fraîche", quantity: 20, unit: "cl", aisle: "cremerie" },
      { name: "Beurre", quantity: 40, unit: "g", aisle: "cremerie" },
      { name: "Farine", quantity: 40, unit: "g", aisle: "epicerie" },
      { name: "Citron", quantity: 1, unit: "", aisle: "fruits_legumes" },
      { name: "Riz", quantity: 400, unit: "g", aisle: "epicerie" },
    ],
  },
  {
    title: "Hachis parmentier",
    emoji: "🥔",
    ingredients: [
      { name: "Bœuf haché", quantity: 600, unit: "g", aisle: "boucherie" },
      { name: "Pommes de terre", quantity: 1.2, unit: "kg", aisle: "fruits_legumes" },
      { name: "Oignons", quantity: 2, unit: "", aisle: "fruits_legumes" },
      { name: "Lait", quantity: 20, unit: "cl", aisle: "cremerie" },
      { name: "Beurre", quantity: 50, unit: "g", aisle: "cremerie" },
      { name: "Gruyère râpé", quantity: 100, unit: "g", aisle: "cremerie" },
    ],
  },
  {
    title: "Gratin dauphinois",
    emoji: "🧀",
    ingredients: [
      { name: "Pommes de terre", quantity: 1.5, unit: "kg", aisle: "fruits_legumes" },
      { name: "Crème fraîche", quantity: 40, unit: "cl", aisle: "cremerie" },
      { name: "Lait", quantity: 50, unit: "cl", aisle: "cremerie" },
      { name: "Ail", quantity: 2, unit: "gousses", aisle: "fruits_legumes" },
      { name: "Muscade", quantity: null, unit: "", aisle: "epicerie" },
    ],
  },
  {
    title: "Poulet rôti et pommes de terre",
    emoji: "🍗",
    ingredients: [
      { name: "Poulet fermier", quantity: 1, unit: "", aisle: "boucherie" },
      { name: "Pommes de terre", quantity: 1, unit: "kg", aisle: "fruits_legumes" },
      { name: "Ail", quantity: 1, unit: "t\u00eate", aisle: "fruits_legumes" },
      { name: "Thym", quantity: 1, unit: "bouquet", aisle: "fruits_legumes" },
      { name: "Beurre", quantity: 30, unit: "g", aisle: "cremerie" },
    ],
  },
  {
    title: "Bœuf bourguignon",
    emoji: "🍷",
    ingredients: [
      { name: "Bœuf à braiser", quantity: 1.5, unit: "kg", aisle: "boucherie" },
      { name: "Vin rouge", quantity: 75, unit: "cl", aisle: "boissons" },
      { name: "Lardons", quantity: 200, unit: "g", aisle: "boucherie" },
      { name: "Carottes", quantity: 4, unit: "", aisle: "fruits_legumes" },
      { name: "Oignons", quantity: 2, unit: "", aisle: "fruits_legumes" },
      { name: "Champignons de Paris", quantity: 250, unit: "g", aisle: "fruits_legumes" },
      { name: "Farine", quantity: 30, unit: "g", aisle: "epicerie" },
      { name: "Bouquet garni", quantity: 1, unit: "", aisle: "fruits_legumes" },
      { name: "Pâtes tagliatelles", quantity: 500, unit: "g", aisle: "epicerie" },
    ],
  },
  {
    title: "Quiche lorraine",
    emoji: "🥧",
    ingredients: [
      { name: "Pâte brisée", quantity: 1, unit: "rouleau", aisle: "cremerie" },
      { name: "Lardons", quantity: 200, unit: "g", aisle: "boucherie" },
      { name: "Œufs", quantity: 3, unit: "", aisle: "cremerie" },
      { name: "Crème fraîche", quantity: 20, unit: "cl", aisle: "cremerie" },
      { name: "Lait", quantity: 20, unit: "cl", aisle: "cremerie" },
      { name: "Gruyère râpé", quantity: 80, unit: "g", aisle: "cremerie" },
      { name: "Salade verte", quantity: 1, unit: "", aisle: "fruits_legumes" },
    ],
  },
  {
    title: "Lasagnes à la bolognaise",
    emoji: "🍝",
    ingredients: [
      { name: "Feuilles de lasagne", quantity: 500, unit: "g", aisle: "epicerie" },
      { name: "Bœuf haché", quantity: 500, unit: "g", aisle: "boucherie" },
      { name: "Coulis de tomate", quantity: 70, unit: "cl", aisle: "epicerie" },
      { name: "Oignon", quantity: 1, unit: "", aisle: "fruits_legumes" },
      { name: "Carotte", quantity: 1, unit: "", aisle: "fruits_legumes" },
      { name: "Lait", quantity: 1, unit: "l", aisle: "cremerie" },
      { name: "Beurre", quantity: 60, unit: "g", aisle: "cremerie" },
      { name: "Farine", quantity: 60, unit: "g", aisle: "epicerie" },
      { name: "Gruyère râpé", quantity: 150, unit: "g", aisle: "cremerie" },
    ],
  },
  {
    title: "Pot-au-feu",
    emoji: "🥕",
    ingredients: [
      { name: "Paleron de bœuf", quantity: 1.5, unit: "kg", aisle: "boucherie" },
      { name: "Os à moelle", quantity: 4, unit: "", aisle: "boucherie" },
      { name: "Carottes", quantity: 6, unit: "", aisle: "fruits_legumes" },
      { name: "Poireaux", quantity: 3, unit: "", aisle: "fruits_legumes" },
      { name: "Navets", quantity: 4, unit: "", aisle: "fruits_legumes" },
      { name: "Pommes de terre", quantity: 800, unit: "g", aisle: "fruits_legumes" },
      { name: "Oignon", quantity: 1, unit: "", aisle: "fruits_legumes" },
      { name: "Bouquet garni", quantity: 1, unit: "", aisle: "fruits_legumes" },
    ],
  },
  {
    title: "Croque-monsieur et salade",
    emoji: "🥪",
    ingredients: [
      { name: "Pain de mie", quantity: 1, unit: "paquet", aisle: "boulangerie" },
      { name: "Jambon blanc", quantity: 8, unit: "tranches", aisle: "boucherie" },
      { name: "Gruyère râpé", quantity: 150, unit: "g", aisle: "cremerie" },
      { name: "Beurre", quantity: 50, unit: "g", aisle: "cremerie" },
      { name: "Salade verte", quantity: 1, unit: "", aisle: "fruits_legumes" },
    ],
  },
  {
    title: "Ratatouille et riz",
    emoji: "🍆",
    ingredients: [
      { name: "Aubergines", quantity: 2, unit: "", aisle: "fruits_legumes" },
      { name: "Courgettes", quantity: 3, unit: "", aisle: "fruits_legumes" },
      { name: "Poivrons", quantity: 2, unit: "", aisle: "fruits_legumes" },
      { name: "Tomates", quantity: 6, unit: "", aisle: "fruits_legumes" },
      { name: "Oignons", quantity: 2, unit: "", aisle: "fruits_legumes" },
      { name: "Ail", quantity: 3, unit: "gousses", aisle: "fruits_legumes" },
      { name: "Huile d'olive", quantity: null, unit: "", aisle: "epicerie" },
      { name: "Riz", quantity: 400, unit: "g", aisle: "epicerie" },
    ],
  },
];
