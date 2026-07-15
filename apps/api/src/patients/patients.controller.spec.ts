import { randomUUID } from 'node:crypto';
import { PatientResponseDto } from './dto/patient-response.dto';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

describe('PatientsController', () => {
  let service: jest.Mocked<Pick<PatientsService, 'list' | 'create' | 'update' | 'remove'>>;
  let controller: PatientsController;

  const response: PatientResponseDto = {
    id: randomUUID(),
    name: 'דנה לוי',
    phone: '054-1234567',
    email: null,
    created_at: '2025-01-15T10:00:00.000Z',
    archived: false,
  };

  beforeEach(() => {
    service = { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() };
    controller = new PatientsController(service as unknown as PatientsService);
  });

  it('GET dispatches the archived flag to the service', async () => {
    service.list.mockResolvedValue([response]);
    await expect(controller.list({ archived: true })).resolves.toEqual([response]);
    expect(service.list).toHaveBeenCalledWith(true);
  });

  it('GET passes the DTO-defaulted archived=false through', async () => {
    service.list.mockResolvedValue([]);
    await controller.list({ archived: false });
    expect(service.list).toHaveBeenCalledWith(false);
  });

  it('POST dispatches the create payload', async () => {
    service.create.mockResolvedValue(response);
    const body = { name: response.name, phone: response.phone };
    await expect(controller.create(body)).resolves.toBe(response);
    expect(service.create).toHaveBeenCalledWith(body);
  });

  it('PATCH dispatches id and body', async () => {
    service.update.mockResolvedValue(response);
    const body = { archived: true };
    await expect(controller.update(response.id, body)).resolves.toBe(response);
    expect(service.update).toHaveBeenCalledWith(response.id, body);
  });

  it('DELETE dispatches the id', async () => {
    service.remove.mockResolvedValue(undefined);
    const id = randomUUID();
    await expect(controller.remove(id)).resolves.toBeUndefined();
    expect(service.remove).toHaveBeenCalledWith(id);
  });
});
