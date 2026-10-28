/**
 * Durée et étapes des recettes de départ (STARTER_RECIPES) : « Je cuisine » ne doit jamais mener à une fiche vide.
 * Quantités des ingrédients : pour 4 personnes.
 */
export const DETAILS_DE_DEPART: Record<string, { minutes: number; steps: string[] }> = {
  "Blanquette de veau": {
    minutes: 120,
    steps: [
      "Couper la viande en gros cubes, éplucher les carottes et l'oignon, nettoyer les champignons.",
      "Mettre la viande dans une cocotte, couvrir d'eau froide, porter à frémissement et écumer. Ajouter les carottes et l'oignon, saler, laisser cuire 1 h 30 à feu doux.",
      "Faire fondre le beurre, ajouter la farine, puis délayer avec un peu de bouillon de cuisson : c'est la sauce.",
      "Ajouter la sauce, la crème, les champignons et le jus d'un demi-citron. Laisser mijoter 15 minutes.",
      "Cuire le riz et servir.",
    ],
  },
  "Hachis parmentier": {
    minutes: 60,
    steps: [
      "Éplucher les pommes de terre, les cuire à l'eau salée 20 minutes, puis les écraser avec le beurre et le lait.",
      "Faire revenir l'oignon, ajouter la viande hachée, saler, poivrer et cuire 10 minutes.",
      "Étaler la viande dans un plat, couvrir de purée, parsemer de gruyère.",
      "Gratiner 20 minutes au four à 200 °C.",
    ],
  },
  "Gratin dauphinois": {
    minutes: 75,
    steps: [
      "Éplucher les pommes de terre et les couper en fines rondelles.",
      "Frotter un plat avec l'ail, puis ranger les pommes de terre en couches, en salant et en ajoutant un peu de muscade.",
      "Verser la crème et le lait mélangés, jusqu'à presque recouvrir.",
      "Cuire 1 heure au four à 170 °C, jusqu'à ce que le dessus soit doré.",
    ],
  },
  "Poulet rôti et pommes de terre": {
    minutes: 90,
    steps: [
      "Préchauffer le four à 200 °C. Éplucher les pommes de terre et les couper en quartiers.",
      "Mettre le poulet dans un plat, le badigeonner de beurre, saler, poivrer, glisser l'ail et le thym dedans.",
      "Entourer de pommes de terre, puis enfourner 1 h 15 en arrosant avec le jus de temps en temps.",
      "Laisser reposer 10 minutes avant de découper.",
    ],
  },
  "Bœuf bourguignon": {
    minutes: 180,
    steps: [
      "Couper le bœuf en cubes. Faire dorer les lardons, puis la viande, dans une cocotte.",
      "Ajouter les oignons et les carottes en morceaux, saupoudrer de farine et mélanger.",
      "Verser le vin, ajouter le bouquet garni, saler, poivrer. Couvrir et laisser mijoter 2 h 30 à feu doux.",
      "Ajouter les champignons 20 minutes avant la fin.",
      "Cuire les tagliatelles et servir.",
    ],
  },
  "Quiche lorraine": {
    minutes: 60,
    steps: [
      "Préchauffer le four à 180 °C. Étaler la pâte dans un moule et la piquer.",
      "Faire revenir les lardons à sec 3 minutes et les répartir sur la pâte.",
      "Battre les œufs avec la crème et le lait, saler, poivrer, verser sur les lardons.",
      "Parsemer de gruyère et cuire 35 minutes, jusqu'à ce que la quiche soit dorée.",
    ],
  },
  "Lasagnes à la bolognaise": {
    minutes: 90,
    steps: [
      "Faire revenir l'oignon et la carotte, ajouter la viande, puis le coulis de tomate. Laisser mijoter 20 minutes.",
      "Préparer la béchamel : faire fondre le beurre, ajouter la farine, puis le lait en fouettant jusqu'à épaississement.",
      "Dans un plat, alterner sauce, feuilles de lasagne et béchamel, en finissant par la béchamel.",
      "Parsemer de gruyère et cuire 40 minutes au four à 180 °C.",
    ],
  },
  "Pot-au-feu": {
    minutes: 180,
    steps: [
      "Mettre le bœuf et les os à moelle dans une grande marmite d'eau froide salée, avec l'oignon et le bouquet garni. Porter à frémissement et écumer.",
      "Laisser cuire 2 heures à petit feu.",
      "Ajouter les carottes, les navets, les poireaux et les pommes de terre. Cuire encore 40 minutes.",
      "Servir la viande avec les légumes et un peu de bouillon.",
    ],
  },
  "Croque-monsieur et salade": {
    minutes: 20,
    steps: [
      "Préchauffer le four à 200 °C. Beurrer légèrement les tranches de pain de mie.",
      "Garnir de jambon et de gruyère, refermer.",
      "Enfourner 10 minutes, jusqu'à ce que le fromage soit fondu et doré.",
      "Servir avec la salade verte assaisonnée.",
    ],
  },
  "Ratatouille et riz": {
    minutes: 60,
    steps: [
      "Couper les aubergines, les courgettes, les poivrons et les tomates en dés.",
      "Faire revenir l'oignon et l'ail dans l'huile d'olive, puis ajouter les aubergines et les poivrons. Cuire 10 minutes.",
      "Ajouter les courgettes et les tomates, saler, poivrer. Laisser mijoter 35 minutes à feu doux.",
      "Cuire le riz et servir avec la ratatouille.",
    ],
  },
};
