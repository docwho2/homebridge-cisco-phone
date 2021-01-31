import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback } 
  from 'homebridge';

import { CiscoPhonePlatform } from './platform';


/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
abstract class BaseAccessory {

  constructor(
    readonly platform: CiscoPhonePlatform,
    readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Name, this.accessory.context.deviceInformation.HostName)
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Cisco')
      .setCharacteristic(this.platform.Characteristic.HardwareRevision, this.accessory.context.deviceInformation.hardwareRevision)
      .setCharacteristic(this.platform.Characteristic.Model, this.accessory.context.deviceInformation.modelNumber)
      .setCharacteristic(this.platform.Characteristic.SoftwareRevision, this.accessory.context.deviceInformation.versionID)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, this.accessory.context.deviceInformation.bootLoadID)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.context.deviceInformation.serialNumber);

    if (this.accessory.context.devicePollingInterval !== 0 ) {
      this.platform.log.info(`Pollinging interval is ${this.accessory.context.devicePollingInterval}`);
      setInterval(() => {
        this.platform.getDeviceInfoX(accessory.context.deviceIPAddress).then(
          (data) => {
            // If MWI has changed, update context and set the state
            if (this.accessory.context.deviceInformation.MessageWaiting !== data.MessageWaiting) {
              this.platform.log.info('MWI has changed, updating accessory');
              this.accessory.context.deviceInformation = data;
              this.setState();
            }
          },
        );
      }, this.accessory.context.devicePollingInterval || 60000);
    }
  }

  abstract setState();

  /**
   * Return true is MWI is set, false otherwise
   */
  getBooleanState(): boolean {
    this.platform.log.info('Device MWI State is ', this.accessory.context.deviceInformation.MessageWaiting);
    if (this.accessory.context.deviceInformation.MessageWaiting === 'Yes') {
      return true;
    } else {
      return false;
    }
  }
}

export class ContactSensorAccessory extends BaseAccessory {
  service: Service;

  constructor(
    readonly platform: CiscoPhonePlatform,
    readonly accessory: PlatformAccessory,
  ) {
    super(platform, accessory);


    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    const check = this.accessory.getService(this.platform.Service.Lightbulb);
    if (check) {
      this.accessory.removeService(check);
    }

    this.service = this.accessory.getService(this.platform.Service.ContactSensor)
      || this.accessory.addService(this.platform.Service.ContactSensor);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.context.deviceInformation.HostName);

    this.setState();

    // register handlers for the Brightness Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.ContactSensorState)
      .on('get', this.getState.bind(this));       // SET - bind to the 'setBrightness` method below
  }

  setState() {
    //  Set the current state
    if (this.getBooleanState()) {
      this.service.setCharacteristic(this.platform.Characteristic.ContactSensorState,
        this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
    } else {
      this.service.setCharacteristic(this.platform.Characteristic.ContactSensorState,
        this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED);
    }
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  getState(callback: CharacteristicSetCallback) {

    if (this.getBooleanState()) {
      this.platform.log.info('Reporting contact NOT detected (MWI is on');
      callback(null, this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
    } else {
      // you must call the callback function
      this.platform.log.info('Reporting contact detected (MWI is off)');
      callback(null, this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED);
    }
  }
}

export class LightAccessory extends BaseAccessory {
  service: Service;

  constructor(
    readonly platform: CiscoPhonePlatform,
    readonly accessory: PlatformAccessory,
  ) {
    super(platform, accessory);


    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    const check = this.accessory.getService(this.platform.Service.ContactSensor);
    if (check) {
      this.accessory.removeService(check);
    }

    this.service = this.accessory.getService(this.platform.Service.Lightbulb)
      || this.accessory.addService(this.platform.Service.Lightbulb);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.context.deviceInformation.HostName);
    this.setState();

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    //this.service.getCharacteristic(this.platform.Characteristic.RelayEnabled)
    //  .on('set', this.setOn.bind(this))                // SET - bind to the `setOn` method below
    //  .on('get', this.getOn.bind(this));               // GET - bind to the `getOn` method below

    // register handlers for the Brightness Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .on('get', this.getState.bind(this))
      .on('set', this.setOn.bind(this));
  }

  setState() {
    this.service.setCharacteristic(this.platform.Characteristic.On, this.getBooleanState());
  }

  setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug('Triggered SET ', value);
    if (value as boolean) {
      this.platform.log.info('Triggered a turn ON, turning off');
      setTimeout(() => {
        this.service.setCharacteristic(this.platform.Characteristic.On, false);
      }, 1000);
    }
    callback(null);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  getState(callback: CharacteristicSetCallback) {
    callback(null, this.getBooleanState());
  }

}
