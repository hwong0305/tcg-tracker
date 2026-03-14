import { cardsRepo } from "../../../../packages/data/src/repos/cards-repo";
import { setsRepo } from "../../../../packages/data/src/repos/sets-repo";

export const dashboardRepo = {
  async getDashboard(filters: {
    printStatus?: string;
    tcgType?: string;
    setId?: string;
    rarity?: string;
    chaseOnly?: boolean;
  }) {
    const sets = await setsRepo.findFiltered(filters);
    const cards = await cardsRepo.findFiltered(filters);
    return { sets, cards };
  }
};
