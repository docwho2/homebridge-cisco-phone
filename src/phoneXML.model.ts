
import { Logger } from 'homebridge';
import { PLATFORM_NAME } from './settings';

import builder = require('xmlbuilder2');
import axios, { AxiosRequestConfig } from 'axios';

/**
 * Soft Keys that are part of any response
 */
export class SoftKeyItem {
    name: string;
    url: string;
    urldown?: string;
    position: string;
}

/**
 * Menu Items
 */
export class MenuItem {
    name: string;
    url: string;
}

export class InputItem {
    name: string;
    param: string;
    type: string;
}

export class DirectoryItem {
    name: string;
    phone: string;
}

export class ExecuteItem {
    URL: string;
    Priority: string;
}

export class XMLOptions {
    appid?: string;
    title?: string;
    prompt?: string;
    softkeys?: SoftKeyItem[];
}

/**
 * Common attributes to all XML Elements
 */
abstract class CiscoXMLRoot {
    protected name: string;
    protected appid?: string;
    protected title?: string;
    protected prompt?: string;
    protected softkeys?: SoftKeyItem[];

    constructor(options: XMLOptions) {
      if ( options.appid !== undefined ) {
        this.appid = options.appid;
      }
      if (options.title !== undefined ) {
        this.title = options.title;
      }
      if ( options.prompt) {
        this.prompt = options.prompt;
      }
      if ( options.softkeys !== undefined ) {
        this.softkeys = options.softkeys;
      }
    }


abstract toXML(): string;

protected _toXML() {
  const xml_root = builder.create({ version: '1.0', encoding: 'ISO-8859-1'});
  
  const xml = xml_root.ele(this.name).att('appId', this.appid || PLATFORM_NAME);

  if (this.title) {
    xml.ele('Title').txt(this.title);
  }
  if (this.prompt) {
    xml.ele('Prompt').txt(this.prompt);
  }
  if ( this.softkeys && this.softkeys.length > 0) {
    this.softkeys.forEach(key => {
      const softkey = xml.ele('SoftKeyItem');
      softkey.ele('Name').txt(key.name);
      softkey.ele('URL').txt(key.url);
      if (key.urldown) {
        softkey.ele('URLDown').txt(key.urldown);
      }
      softkey.ele('Position').txt(key.position);
    });
  }

  return (xml);
}
}

export class CiscoIPPhoneMenu extends CiscoXMLRoot {
    private menuitems: MenuItem[];
    constructor(options: XMLOptions, menuOptions: MenuItem[]) {
      super(options);
      this.name = 'CiscoIPPhoneMenu';
      this.menuitems = menuOptions;
    }

    toXML() {
      const xml_root = super._toXML();
      this.menuitems.forEach(mitem => {
        const item = xml_root.ele('MenuItem');
        item.ele('Name').txt(mitem.name);
        item.ele('URL').txt(mitem.url);
      });

      return xml_root.end();
    }
}

export class CiscoIPPhoneText extends CiscoXMLRoot {
    private text: string;
    constructor(options: XMLOptions, text: string) {
      super(options);
      this.name = 'CiscoIPPhoneText';
      this.text = text;
    }

    toXML() {
      const xml_root = super._toXML();
      xml_root.ele('Text').txt(this.text);
      return xml_root.end();
    }
}


/*
 URL: The URL the phone will visit when the user enters the value(s) asked for
   fields: An array of objects with the following properties:
   name: The name of the field asked for
   param: The name of the HTTP GET parameter passed to the URL when done
   type: Field type - A for ascii text; T for a telephone number; 
       N for a numeric value; E for a mathematical expression; 
       U for uppercase text; L for lowercase text. Add a "P" to the type 
       to make it a password (phone will obscure entry)
*/
export class CiscoIPPhoneInput extends CiscoXMLRoot {
    private url: string;
    private inputitems: InputItem[];
    constructor(options: XMLOptions, url: string, items: InputItem[]) {
      super(options);
      this.name = 'CiscoIPPhoneInput';
      this.url = url;
      this.inputitems = items;
    }

    toXML() {
      const xml_root = super._toXML();
      this.inputitems.forEach(inputitem => {
        const item = xml_root.ele('InputItem');
        item.ele('DisplayName').txt(inputitem.name);
        item.ele('QueryStringParam').txt(inputitem.param);
        item.ele('InputFlags').txt(inputitem.type);
      });
      xml_root.ele('URL').txt(this.url);
      return xml_root.end();
    }
}

export class CiscoIPPhoneDirectory extends CiscoXMLRoot {
    private entries: DirectoryItem[];
    constructor(options: XMLOptions, entries: DirectoryItem[]) {
      super(options);
      this.name = 'CiscoIPPhoneDirectory';
      this.entries = entries;
    }

    toXML() {
      const xml_root = super._toXML();
      this.entries.forEach(entry => {
        const item = xml_root.ele('DirectoryEntry');
        item.ele('Name').txt(entry.name);
        item.ele('Telephone').txt(entry.phone);
      });
      return xml_root.end();
    }

}

/**  Builds a CiscoUIPPhoneExecute payload
  // This is used to execute arbitrary commands on the phone
  // commands: an object, each property being a command (URL), and each key
  //   being the "priority" of the command, as follows:
  //     0: Execute immediatly
  //     1: Queue - delay execution until phone is idle
  //     2: Execute only if phone is idle
  **/
export class CiscoIPPhoneExecute extends CiscoXMLRoot {
    commands: ExecuteItem[];
    constructor(commands: ExecuteItem[]) {
      super({});
      this.commands = commands;
    }

    toXML() {
      const xml_root = builder.create({ version: '1.0', encoding: 'ISO-8859-1'});
      const ex = xml_root.ele('CiscoIPPhoneExecute');
      this.commands.forEach(command => {
        ex.ele('ExecuteItem', { URL: command.URL, Priority: command.Priority });
      });
      return xml_root.end();
    }
}

/**
 * Represents a phone to communicate with
 */
export class CiscoIPPhone {
    host: string;
    port?: number;
    username?: string;
    password?: string;
}

/**
 * Send and Poll Phone For Information
 */
export class PhoneCommunicator {
    private phone: CiscoIPPhone;
    private log: Logger;

    constructor(phone: CiscoIPPhone, log: Logger) {
      this.phone = phone;
      this.log = log;
    }

    /**
     * Send XML to phone to execute.  Each result is logged to the HomeKit Console
     * 
     * @param xmlObject Payload to send to the Phone
     * @return Status Code from POST
     */
    send(xmlObject: CiscoXMLRoot) : Promise<number> {
      // convert to XML
      const xml = xmlObject.toXML();

      const options: AxiosRequestConfig = {
        baseURL: 'http://' + this.phone.host + ':' + (this.phone.port || 80),
        method: 'POST',
        responseType: 'text',
        headers: {
          'content-type': 'text/xml; charset:ISO-8859-1',
        },
      };

      if (this.phone.username && this.phone.password) {
        options.auth = { username: this.phone.username, password: this.phone.password };
      }
      this.log.debug('Posting ', xml.toString());
      return new Promise((resolve, reject)=> {
        axios.post('/CGI/Execute', `XML=${xml}`, options).then((response) => {
          // Convert to XML Document
          const xml = builder.create(response.data);

          // Traverse the document and log each repsonse for logging
          xml.root().each((element) => {
            this.log.info(element.toString());
          });

          resolve(response.status);
        }).catch((err) => {
          this.log.error(err);
          reject(err);
        });

      });
    }

    /**
     * Get Device Information like serial, model, etc.
     * Most importantly this provided MWI status
     */
    public getDeviceInfoX(): Promise<Record<string, string>> {
      return this.getDeviceInfo('/DeviceInformationX');
    }

    /**
     * Get the Networking configuration
     */
    public getNetworkInfoX(): Promise<Record<string, string>> {
      return this.getDeviceInfo('/NetworkConfigurationX');
    }

    /**
     * Get Stream Information, most notibly to determine if the phone
     * is on a call or not.  Handles the general case.
     */
    public getStreamInfoX(): Promise<Record<string, string>> {
      return this.getDeviceInfo('/StreamingStatisticsX?n1');
    }

    /**
     * Perform a GET on the phone for information, these operations
     * don't require authentication, though we send it if provided
     * @param url 
     */
    private getDeviceInfo(url: string): Promise<Record<string, string>> {

      const options: AxiosRequestConfig = {
        baseURL: 'http://' + this.phone.host + ':' + (this.phone.port || 80),
        method: 'GET',
        responseType: 'text',
      };

      if (this.phone.username && this.phone.password) {
        options.auth = { username: this.phone.username, password: this.phone.password };
      }

      return new Promise((resolve, reject) => {
        axios.get(url, options).then((response) => {
          this.log.debug('Raw Response is ' + response.data);
          // Convert to XML Document
          const xml = builder.create(response.data);

          // Traverse the document and produce a flat JS Object
          const result: Record<string, string> = {};
          xml.root().each((element) => {
            result[element.node.nodeName] = element.node.textContent;
          });
          //this.log.info(JSON.stringify(result));
          resolve(result);
        }).catch((err) => {
          this.log.error(err);
          reject(err);
        });

      });
    }



}