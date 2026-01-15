
export class DeliveryRepository {
  static async findAll(filters?: DeliveryFilters) {
    return db.getAllAsync<Delivery>(/* requête avec filtres */);
  }

  static async findById(id: number) {
    return db.getFirstAsync<Delivery>("SELECT * FROM deliveries WHERE id = ?", [id]);
  }

  static async create(deliveryData: CreateDeliveryDTO) {
    return db.runAsync(/* requête d'insertion */);
  }

  static async updateStatus(id: number, status: DeliveryStatus) {
    return db.runAsync(/* requête de mise à jour */);
  }
}