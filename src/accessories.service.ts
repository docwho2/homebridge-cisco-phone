
import path from 'path';
import fs from 'fs-extra';

import { HapClient, ServiceType } from '@oznu/hap-client';
import { BadRequestException } from '@nestjs/common';
import { Logger, API } from 'homebridge';

export class AccessoriesService {
    public hapClient: HapClient = undefined;

    constructor(
        private readonly api: API,
        private readonly logger: Logger,
    ) { }


    async init() {
      try {  
        const homebridgeConfig = await fs.readJson(path.resolve(this.api.user.configPath()));
        this.logger.info(`Read Config and PIN is ${homebridgeConfig.bridge.pin}`);
        this.hapClient = new HapClient({
          pin: homebridgeConfig.bridge.pin,
          logger: this.logger,
          config: { debug: true },
        });
        this.logger.info('HAP Configured');
      } catch(err) {
        this.logger.error(err);
      }
    }

    /**
   * Refresh the characteristics from Homebridge
   * @param services
   */
    private refreshCharacteristics(services: ServiceType[]) {
      services.forEach(service => service.refreshCharacteristics());
    }

    /**
   * Load all the accessories from Homebridge
   * @param refreshServices
   */
    public async loadAccessories(): Promise<ServiceType[]> {
      return this.hapClient.getAllServices()
        .then(services => {
          this.logger.info(`Got Services from loadAccesories with length ${services.length}`);
          return services;
        })
        .catch((e) => {
          if (e.response?.status === 401) {
            this.logger.warn('Homebridge must be running in insecure mode to view and control accessories from this plugin.');
          } else {
            this.logger.error(`Failed load accessories from Homebridge: ${e.message}`);
          }
          return [];
        });
    }
  

    /**
   * Get a single accessory and refresh it's characteristics
   * @param uniqueId
   */
    public async getAccessory(uniqueId: string) {
      const services = await this.loadAccessories();
      const service = services.find(x => x.uniqueId === uniqueId);

      if (!service) {
        throw new BadRequestException(`Service with uniqueId of '${uniqueId}' not found.`);
      }

      try {
        await service.refreshCharacteristics();
        return service;
      } catch (e) {
        throw new BadRequestException(e.message);
      }
    }

    /**
   * Set a characteristics value
   * @param uniqueId
   * @param iid
   * @param value
   */
    public async setAccessoryCharacteristic(uniqueId: string, characteristicType: string, value: number | boolean | string) {
      const services = await this.loadAccessories();
      const service = services.find(x => x.uniqueId === uniqueId);

      if (!service) {
        throw new BadRequestException(`Service with uniqueId of '${uniqueId}' not found.`);
      }

      const characteristic = service.getCharacteristic(characteristicType);

      if (!characteristic || !characteristic.canWrite) {
        const types = service.serviceCharacteristics.filter(x => x.canWrite).map(x => `'${x.type}'`).join(', ');
        throw new BadRequestException(`Invalid characteristicType. Valid types are: ${types}.`);
      }

      // integers
      if (['uint8', 'uint16', 'uint32', 'uint64'].includes(characteristic.format)) {
        value = parseInt(value as string, 10);
        if (characteristic.minValue !== undefined && value < characteristic.minValue) {
          throw new BadRequestException(`Invalid value. The value must be between ${characteristic.minValue} 
          and ${characteristic.maxValue}.`);
        }
        if (characteristic.maxValue !== undefined && value > characteristic.maxValue) {
          throw new BadRequestException(`Invalid value. The value must be between ${characteristic.minValue} 
          and ${characteristic.maxValue}.`);
        }
      }

      // floats
      if (characteristic.format === 'float') {
        value = parseFloat(value as string);
        if (characteristic.minValue !== undefined && value < characteristic.minValue) {
          throw new BadRequestException(`Invalid value. The value must be between ${characteristic.minValue} 
          and ${characteristic.maxValue}.`);
        }
        if (characteristic.maxValue !== undefined && value > characteristic.maxValue) {
          throw new BadRequestException(`Invalid value. The value must be between ${characteristic.minValue} 
          and ${characteristic.maxValue}.`);
        }
      }

      // booleans
      if (characteristic.format === 'bool') {
        if (typeof value === 'string') {
          if (['true', '1'].includes(value.toLowerCase())) {
            value = true;
          } else if (['false', '0'].includes(value.toLowerCase())) {
            value = false;
          }
        } else if (typeof value === 'number') {
          value = value === 1 ? true : false;
        }

        if (typeof value !== 'boolean') {
          throw new BadRequestException('Invalid value. The value must be a boolean (true or false).');
        }
      }

      try {
        await characteristic.setValue(value);
        await service.refreshCharacteristics();
        return service;
      } catch (e) {
        throw new BadRequestException(e.message);
      }
    }


}
