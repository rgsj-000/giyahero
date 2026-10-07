export type MarketplaceNavigation = {
  openPackage(id: string): void;
  openTrips(): void;
  requireLogin(returnPath: string): void;
  openAgencyWorkspace(agencyId: string): void;
};
