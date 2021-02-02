import express from 'express';

import { Logger } from 'homebridge';
import { CiscoIPPhoneMenu, XMLOptions, MenuItem } from './phoneXML.model';


export class PhoneExpressServer {
    app: express;
    log: Logger;

    constructor(log: Logger, port ?: number ) {
      this.app = express();
      this.log = log;
      const server = this.app.listen(port, () => {
        const host = server.address().hostname;
        const port = server.address().port;
        log.info(`IP Phone Web Server listening at http://${host}:${port}`);
      });
    

      // When the phone queries "/", display a menu to see the rest of examples
      this.app.get('/', (req, res) => {
        this.log.info('Request for root /');
        // I don't trust the phones to handle relative URLs, so
        //   build it again, using the same hostname (in case
        //   our test server has several network interfaces)
        const self = 'http://' + req.headers.host + '/';

        // If the Content-type HTTP header is not set, phones will not parse the payload.
        res.setHeader('Content-type', 'text/xml');

        res.send( new CiscoIPPhoneMenu( {title: 'HomeBridge Menu'}, [ 
          {name : 'PLay Piano Sound', url : 'Play:Piano1.raw'},
          {name : 'PLay Piano Sound 2', url : 'Play:Piano2.raw'},
        ] ).toXML());
      });

      // When the phone queries "/", display a menu to see the rest of examples
      this.app.get('/services', (req, res) => {
        this.log.info('Request for root /services');
        // I don't trust the phones to handle relative URLs, so
        //   build it again, using the same hostname (in case
        //   our test server has several network interfaces)
        const self = 'http://' + req.headers.host + '/';

        // If the Content-type HTTP header is not set, phones will not parse the payload.
        res.setHeader('Content-type', 'text/xml');

        res.send( new CiscoIPPhoneMenu( {title: 'HomeBridge Menu'}, [ 
          {name : 'PLay Piano Sound', url : 'Play:Piano1.raw'},
          {name : 'PLay Piano Sound 2', url : 'Play:Piano2.raw'},
        ] ).toXML());
      });

      /**
       * Auth Endpoint that can be used to always authorize operations on the IP Phone
       * 
       */
      this.app.get('/auth', (req, res) => {
        res.setHeader('Content-type', 'text/plain');
        // Always send back Authorized to enable authenticated pushes
        res.send('AUTHORIZED');
      });

    }

}