
import { ExecuteItem } from './phoneXML.model';
/**
 * Class that represents the config.schema entry for a Single IP Phone
 */
export class IPPhoneConfiguration {
    // Configured IP Address of the Phone
    IPAddress: string;
    // The Homekit type to create ( contact sensor, light, fan, etc.)
    DeviceType: string;
    // How often to poll the phone in MS for MWI updates
    PollingInterval: number;

    // Actions for this phone
    Actions?: ActionConfiguration[];

    constructor( ip: string, type: string, interval ? : number) {
      this.IPAddress = ip;
      this.DeviceType = type;
      this.PollingInterval = interval || 60000;
    }
}

export class ActionConfiguration {
   ExecItems: ExecuteItem[];
   DeviceName: string;
}
