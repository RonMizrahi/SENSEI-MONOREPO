import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListPatientsQueryDto } from './list-patients-query.dto';

function toDto(query: Record<string, unknown>): ListPatientsQueryDto {
  return plainToInstance(ListPatientsQueryDto, query);
}

describe('ListPatientsQueryDto', () => {
  it('defaults archived to false when absent', async () => {
    const dto = toDto({});
    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.archived).toBe(false);
  });

  it("parses archived='true' as true", async () => {
    const dto = toDto({ archived: 'true' });
    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.archived).toBe(true);
  });

  it.each([['false'], ['1'], ['TRUE'], ['']])(
    "treats archived=%p as false (only 'true' opts in)",
    async (value) => {
      const dto = toDto({ archived: value });
      await expect(validate(dto)).resolves.toEqual([]);
      expect(dto.archived).toBe(false);
    },
  );

  it('a repeated archived param resolves to the last occurrence', async () => {
    const trueLast = toDto({ archived: ['false', 'true'] });
    await expect(validate(trueLast)).resolves.toEqual([]);
    expect(trueLast.archived).toBe(true);

    const falseLast = toDto({ archived: ['true', 'false'] });
    await expect(validate(falseLast)).resolves.toEqual([]);
    expect(falseLast.archived).toBe(false);
  });
});
