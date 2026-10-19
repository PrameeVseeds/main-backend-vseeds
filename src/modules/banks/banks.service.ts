import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import { BankResponseDto } from './dto/bank-response.dto';
import { Bank } from '@prisma/client';

@Injectable()
export class BanksService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async onModuleInit() {
    const count = await this.prisma.bank.count();
    if (count === 0) {
      await this.prisma.bank.createMany({
        data: [
          {
            bankName: 'Sampath Bank',
            branch: 'Negombo',
            accountNumber: 'xxxxxxxxxx',
            accountName: 'SEEDS (PVT) LTD',
            isActive: true,
            displayOrder: 1,
          },
          {
            bankName: 'Bank of Ceylon',
            branch: 'Negombo',
            accountNumber: 'xxxxxxxxxx',
            accountName: 'SEEDS (PVT) LTD',
            isActive: true,
            displayOrder: 2,
          },
        ],
      });
    }
  }

  private toResponseDto(bank: Bank): BankResponseDto {
    return {
      id: bank.id,
      bankName: this.encryptionService.decrypt(bank.bankName),
      branch: this.encryptionService.decrypt(bank.branch),
      accountNumber: this.encryptionService.decrypt(bank.accountNumber),
      accountName: this.encryptionService.decrypt(bank.accountName),
      isActive: bank.isActive,
      displayOrder: bank.displayOrder,
      createdAt: bank.createdAt,
      updatedAt: bank.updatedAt,
    };
  }

  async create(dto: CreateBankDto): Promise<BankResponseDto> {
    const saved = await this.prisma.bank.create({
      data: dto,
    });
    return this.toResponseDto(saved);
  }

  async findAll(): Promise<BankResponseDto[]> {
    const banks = await this.prisma.bank.findMany({
      orderBy: [{ displayOrder: 'asc' }, { bankName: 'asc' }],
    });
    return banks.map((b) => this.toResponseDto(b));
  }

  async findActive(): Promise<BankResponseDto[]> {
    const banks = await this.prisma.bank.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { bankName: 'asc' }],
    });
    return banks.map((b) => this.toResponseDto(b));
  }

  async findOne(id: string): Promise<BankResponseDto> {
    const bank = await this.prisma.bank.findUnique({
      where: { id },
    });
    if (!bank) {
      throw new NotFoundException(`Bank with ID ${id} not found`);
    }
    return this.toResponseDto(bank);
  }

  async update(id: string, dto: UpdateBankDto): Promise<BankResponseDto> {
    await this.findOne(id);
    const saved = await this.prisma.bank.update({
      where: { id },
      data: dto,
    });
    return this.toResponseDto(saved);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.bank.delete({
      where: { id },
    });
  }
}
