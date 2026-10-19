export enum QuoteStatus {
  PENDING = 'pending',
  QUOTED = 'quoted',
  APPROVED = 'approved',
  DECLINED = 'declined',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

export enum ServiceType {
  STANDARD_PCB = 'standard_pcb',
  ADVANCED_PCB = 'advanced_pcb',
  FPC_RIGID_FLEX = 'fpc_rigid_flex',
  PCB_ASSEMBLY = 'pcb_assembly',
  SMD_STENCIL = 'smd_stencil',
}
