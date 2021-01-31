import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { IPPhoneConfiguration } from './ipPhoneConfiguration';
import { ContactSensorAccessory, LightAccessory } from './platformAccessory';
import { ServiceType } from '@oznu/hap-client';
import { AccessoriesService } from './accessories.service';


import CUIPP = require('cuipp');
import util = require('util');
import { SSL_OP_EPHEMERAL_RSA } from 'constants';
const getDeviceInfo = util.promisify(CUIPP.getDeviceInfo);

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class CiscoPhonePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }


  async getDeviceInfoX(ip: string) {
    try {
      const phone = { host: ip };
      this.log.debug('Connecting to device ', ip);
      const deviceXML = await getDeviceInfo(phone);
      this.log.debug('Got DeviceInformtionX from Phone ', deviceXML);
      return deviceXML;
    } catch (err) {
      this.log.error(`Error getting DeviceInformationX from ${ip}`, err);
      return null;
    }
  }

  sleep (ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  async discoverDevices() {

    setTimeout(async () => {
      const aService = new AccessoriesService(this.api, this.log);
      await aService.init();
      await this.sleep(20000);
      const services: ServiceType[] = await aService.loadAccessories();
      services.forEach(service => this.log.info(JSON.stringify(service, null, 2)));
    }, 10000);

    // EXAMPLE ONLY
    // A real plugin you would discover accessories from the local network, cloud services
    // or a user-defined array in the platform config.
    const devices = this.config.phones as IPPhoneConfiguration[];

    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of devices ) {
      const deviceXML = await this.getDeviceInfoX(device.IPAddress);
      if ( ! deviceXML ) {
        continue;
      }

      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(deviceXML.HostName);

      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        // the accessory already exists
        if (device) {
          this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

          // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
          // existingAccessory.context.device = device;
          // this.api.updatePlatformAccessories([existingAccessory]);

          // create the accessory handler for the restored accessory
          // this is imported from `platformAccessory.ts`
          existingAccessory.context.deviceInformation = deviceXML;
          existingAccessory.context.deviceIPAddress = device.IPAddress;
          existingAccessory.context.devicePollingInterval = device.PollingInterval || 60000;
          switch (device.DeviceType || 'contact') {
            case 'light':
              new LightAccessory(this, existingAccessory);
              break;
            case 'contact':
              new ContactSensorAccessory(this, existingAccessory);
              break;
          }

          // update accessory cache with any changes to the accessory details and information

          this.api.updatePlatformAccessories([existingAccessory]);
        } else if (!device) {
          // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
          // remove platform accessories when no longer present
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
          this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
        }
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', deviceXML.HostName);

        // create a new accessory
        const accessory = new this.api.platformAccessory(deviceXML.HostName, uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.deviceInformation = deviceXML;
        accessory.context.deviceIPAddress = device.IPAddress;
        accessory.context.devicePollingInterval = device.PollingInterval || 60000;

        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        switch (device.DeviceType || 'contact') {
          case 'light':
            new LightAccessory(this, accessory);
            break;
          case 'contact':
            new ContactSensorAccessory(this, accessory);
            break;
        }


        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}
