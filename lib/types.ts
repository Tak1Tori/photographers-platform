export interface PhotoStyle {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  startingPrice: number;
}

export type UserRole = "CLIENT" | "PHOTOGRAPHER" | "STUDIO_OWNER" | "ADMIN";

export type BookingStatus = "Pending" | "Confirmed" | "Completed" | "Cancelled";
export type ExtendedBookingStatus = BookingStatus | "Declined";
export type BookingPaymentStatus = "UNPAID" | "DEPOSIT_PAID" | "PAID" | "REFUNDED" | "FAILED";
export type BookingType = "FULL_SHOOT" | "PHOTOGRAPHER_ONLY" | "STUDIO_ONLY";
export type ShootType =
  | "PERSONAL"
  | "EVENT"
  | "WEDDING"
  | "BIRTHDAY"
  | "BUSINESS"
  | "CONTENT"
  | "PRODUCT"
  | "REPORTAGE"
  | "OTHER";
export type LocationType =
  | "OUTDOOR"
  | "CLIENT_HOME"
  | "OFFICE"
  | "RESTAURANT"
  | "EVENT_PLACE"
  | "STUDIO_ALREADY_BOOKED"
  | "NEED_STUDIO_HELP"
  | "OTHER";
export type EquipmentNeeded =
  | "NO_SPECIAL_EQUIPMENT"
  | "LIGHTING"
  | "BACKDROP"
  | "PRODUCT_TABLE"
  | "TRIPOD"
  | "VIDEO_LIGHT"
  | "OTHER";
export type RentalPurpose =
  | "PERSONAL_SHOOT"
  | "COMMERCIAL_SHOOT"
  | "CONTENT_SHOOT"
  | "PRODUCT_SHOOT"
  | "VIDEO_SHOOT"
  | "CASTING"
  | "WORKSHOP"
  | "EVENT"
  | "OTHER";
export type StudioEquipment =
  | "LIGHTING"
  | "BACKDROP"
  | "CYCLORAMA"
  | "MAKEUP_TABLE"
  | "CHANGING_ROOM"
  | "SOFTBOX"
  | "TRIPOD"
  | "STEAMER"
  | "SPEAKERS"
  | "OTHER";
export type BookingFlowMode = BookingType;
export type BookingEntryPoint = "TYPE_SELECTOR" | "CATALOG" | "DETAIL_PAGE" | "LEGACY_FLOW";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
export type PaymentProvider = "MOCK" | "CLOUDPAYMENTS" | "KASPI" | "MANUAL";
export type PaymentType = "DEPOSIT" | "FULL_PAYMENT" | "REFUND";
export type ClientBookingFilter =
  | "All"
  | "Pending"
  | "Confirmed"
  | "Completed"
  | "Cancelled"
  | "Declined";

export type ProfileStatus = "Published" | "Draft" | "Blocked";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
}

export interface AvailableSlot {
  id: string;
  date: string;
  label: string;
  times: string[];
}

export interface AvailabilitySlot {
  id: string;
  day: string;
  time: string;
  enabled: boolean;
}

export interface DashboardAvailabilitySlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  studioHallId?: string;
  studioHallName?: string;
}

export interface PortfolioItem {
  id: string;
  imageUrl: string;
  imagePublicId?: string;
  title: string;
  description: string;
}

export interface Photographer {
  id: string;
  name: string;
  city: string;
  bio: string;
  specializationIds: string[];
  pricePerHour: number;
  rating: number;
  imageUrl: string;
  portfolio: string[];
  availableSlotIds: string[];
}

export interface StudioHall {
  id?: string;
  name: string;
  description?: string;
  capacity: number;
  pricePerHour: number;
  amenities?: string[];
  status?: "Active" | "Inactive";
  imageUrl?: string;
  imagePublicId?: string;
}

export interface Studio {
  id: string;
  name: string;
  hallName: string;
  city: string;
  district: string;
  address: string;
  description: string;
  pricePerHour: number;
  capacity: number;
  rating: number;
  imageUrl: string;
  gallery: string[];
  amenities: string[];
  rules: string[];
  halls: StudioHall[];
  suitableStyleIds: string[];
  availableSlotIds: string[];
  primaryHallId?: string;
}

export interface MockBooking {
  id: string;
  styleId: string;
  photographerId: string;
  studioId: string;
  slotId: string;
  time: string;
  durationHours: number;
  status: "pending_confirmation" | "confirmed";
}

export interface Booking {
  id: string;
  dbId?: string;
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientComment?: string;
  bookingType: BookingType;
  photographerId: string;
  studioId: string;
  photographerName?: string;
  studioName?: string;
  studioAddress?: string;
  styleId: string;
  shootType?: string;
  shootDescription?: string;
  locationType?: string;
  city?: string;
  district?: string;
  addressDetails?: string;
  peopleCount?: number;
  equipmentNeeded?: string[];
  specialRequirements?: string;
  rentalPurpose?: string;
  needsEquipment?: boolean;
  selectedAmenities?: string[];
  hallName: string;
  date: string;
  time: string;
  durationHours: number;
  photographerTotal: number;
  studioTotal: number;
  serviceFee: number;
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: BookingPaymentStatus;
  rescheduleRequestedAt?: string;
  rescheduleComment?: string;
  status: ExtendedBookingStatus;
}

export interface ClientBookingListItem extends Booking {
  styleName: string;
  photographerName: string;
  studioName: string;
  studioAddress: string;
  createdAt: string;
}

export interface ClientBookingDetails extends ClientBookingListItem {
  endTime: string;
  clientEmail: string;
  clientPhone: string;
  clientComment?: string;
  review?: {
    id: string;
    rating: number;
    comment?: string;
    photographerId?: string;
    studioId?: string;
  };
}

export interface ClientDashboardStats {
  totalBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  paidDepositTotal: number;
}

export interface CreateClientReviewInput {
  bookingNumber: string;
  rating: number;
  comment?: string;
  reviewPhotographer: boolean;
  reviewStudio: boolean;
}

export interface CreateBookingInput {
  clientId?: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientComment?: string;
  styleId: string;
  photographerId: string;
  studioId: string;
  studioHallId?: string;
  date: string;
  startTime: string;
  durationHours: number;
  photographerPrice: number;
  studioPrice: number;
  serviceFee: number;
  totalPrice: number;
}

export interface CreatePhotographerOnlyBookingInput {
  clientId?: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  photographerId: string;
  shootType: string;
  shootDescription: string;
  locationType: string;
  city: string;
  district?: string;
  addressDetails?: string;
  date: string;
  startTime: string;
  durationHours: number;
  peopleCount?: number;
  equipmentNeeded: string[];
  specialRequirements?: string;
}

export interface CreateStudioOnlyBookingInput {
  clientId?: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  studioId?: string;
  studioHallId: string;
  rentalPurpose: string;
  shootDescription: string;
  date: string;
  startTime: string;
  durationHours: number;
  peopleCount?: number;
  needsEquipment: boolean;
  selectedAmenities: string[];
  specialRequirements?: string;
}

export interface CreateBookingResult {
  success: boolean;
  bookingNumber?: string;
  checkoutUrl?: string;
  paymentId?: string;
  error?: string;
}

export interface PaymentDTO {
  id: string;
  bookingNumber: string;
  clientName: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: PaymentProvider;
  type: PaymentType;
  createdAt: string;
}

export interface AdminNotificationDTO {
  id: string;
  userName: string;
  userEmail: string;
  type: string;
  title: string;
  isRead: boolean;
  createdAt: string;
  deliveryLogs: Array<{
    channel: string;
    status: string;
    provider?: string;
    errorMessage?: string;
    createdAt: string;
  }>;
}

export interface BookingPaymentSummary {
  bookingId: string;
  bookingNumber: string;
  paymentStatus: BookingPaymentStatus;
  depositAmount: number;
  paidAmount: number;
  remainingAmount: number;
  totalPrice: number;
}

export interface CheckoutBookingDTO extends BookingPaymentSummary {
  styleTitle: string;
  photographerName: string;
  studioName: string;
  date: string;
  time: string;
}

export interface PhotographerProfile {
  id: string;
  photographerId: string;
  name: string;
  city: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  specializationIds: string[];
  pricePerHour: number;
  bio: string;
  status: ProfileStatus;
  rating: number;
  portfolio: string[];
}

export interface StudioProfile {
  id: string;
  studioId: string;
  name: string;
  city: string;
  address: string;
  imageUrl?: string;
  imagePublicId?: string;
  description: string;
  rules: string[];
  status: ProfileStatus;
  halls: StudioHall[];
}

export interface DashboardStats {
  label: string;
  value: string;
  hint?: string;
}
