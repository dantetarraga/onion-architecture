import { SlotType } from '../../domain/enums/slot-type.enum';

/**
 * Mensaje que viaja por la cola de solicitudes de reserva. Es el contrato
 * entre el adaptador HTTP (que encola) y el worker (que procesa): todo lo
 * necesario para ejecutar `CreateReservationUseCase` mas tarde, en otro
 * proceso, sin el request HTTP original.
 *
 * `requestId` lo genera el nucleo al encolar y viaja de vuelta al usuario
 * por WebSocket, de modo que el navegador pueda correlacionar el resultado
 * con la solicitud que envio.
 */
export interface ReservationRequestMessage {
  requestId: string;
  userId: string;
  branchId: string;
  slotType?: SlotType;
  startAt?: Date;
  requestedAt: Date;
}

/**
 * Puerto OUT: el nucleo necesita depositar la solicitud en una cola de
 * trabajo para que se procese fuera del ciclo request/response. El nucleo
 * no sabe que existe RabbitMQ, ni exchanges, ni routing keys.
 *
 * A diferencia de `NotificationPublisherPort` (Kafka, efecto secundario
 * que nunca debe tumbar el flujo), aqui encolar SI es critico: si el
 * mensaje no entra a la cola la reserva jamas ocurrira, asi que el
 * adaptador debe lanzar y el caso de uso traducirlo a un error de dominio.
 */
export interface ReservationRequestQueuePort {
  enqueue(message: ReservationRequestMessage): Promise<void>;
}
