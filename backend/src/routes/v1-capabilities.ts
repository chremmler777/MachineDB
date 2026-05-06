import { Router, Request, Response } from 'express';

const router = Router();

// Static vocabulary for the two_k_type enum. Mirrors the contract fixture at
// docs/contracts/rfq/two-k-vocabulary.json. RFQ pulls this on startup / TTL
// refresh and seeds its tooling_mode -> two_k_type mapping table from it.
const TWO_K_TYPES = [
  {
    value: '2k_turntable',
    label: '2K — Turntable',
    description:
      'Rotating platen, standard overmolding. Tool sits on a turntable; the platen rotates 180 degrees between station 1 and station 2.',
  },
  {
    value: '2k_no_turntable',
    label: '2K — No turntable',
    description:
      'Two injection units, no rotation. Index plate, sliding tool, or core-back transfer; the tool itself handles part movement.',
  },
  {
    value: 'parallel_injection',
    label: 'Parallel injection',
    description:
      'Two separate tools, two injection units. Each tool can use one or both injection units. Used for high-mix low-volume on large Nissei/Sumitomo machines.',
  },
];

router.get('/two-k-types', (_req: Request, res: Response) => {
  res.json({ two_k_types: TWO_K_TYPES });
});

export default router;
