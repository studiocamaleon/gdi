-- Expand enum TipoComponenteDesgasteMaquina with granular laser components.
ALTER TYPE "TipoComponenteDesgasteMaquina" ADD VALUE IF NOT EXISTS 'DRUM_OPC';
ALTER TYPE "TipoComponenteDesgasteMaquina" ADD VALUE IF NOT EXISTS 'DEVELOPER_UNIT';
ALTER TYPE "TipoComponenteDesgasteMaquina" ADD VALUE IF NOT EXISTS 'CHARGE_UNIT';
ALTER TYPE "TipoComponenteDesgasteMaquina" ADD VALUE IF NOT EXISTS 'DRUM_CLEANING_BLADE';
ALTER TYPE "TipoComponenteDesgasteMaquina" ADD VALUE IF NOT EXISTS 'TRANSFER_BELT_ITB';
ALTER TYPE "TipoComponenteDesgasteMaquina" ADD VALUE IF NOT EXISTS 'TRANSFER_ROLLER';
ALTER TYPE "TipoComponenteDesgasteMaquina" ADD VALUE IF NOT EXISTS 'FUSER_BELT';
ALTER TYPE "TipoComponenteDesgasteMaquina" ADD VALUE IF NOT EXISTS 'PRESSURE_ROLLER';
ALTER TYPE "TipoComponenteDesgasteMaquina" ADD VALUE IF NOT EXISTS 'FUSER_CLEANING_WEB';
ALTER TYPE "TipoComponenteDesgasteMaquina" ADD VALUE IF NOT EXISTS 'WAX_LUBRICANT_BAR';
ALTER TYPE "TipoComponenteDesgasteMaquina" ADD VALUE IF NOT EXISTS 'FUSER_STRIPPER_FINGER';
ALTER TYPE "TipoComponenteDesgasteMaquina" ADD VALUE IF NOT EXISTS 'WASTE_TONER_SUBSYSTEM';
