import base64url from 'base64url';
import IpfsStorage from './IpfsStorage';
import { Response, ResponseStatus } from './Response';
import { Timeout } from './lib/Timeout';
const multihashes = require('multihashes');

/**
 * IPFS options for creation of IPFS node
 */
interface Options {
  /** Init IPFS options */
  init?: boolean;
  /** Boolean option to start ipfs node defaults to true */
  start?: boolean;
  /** IPFS experimental features */
  EXPERIMENTAL?: any;
  /** IPFS repo object */
  repo?: string;
  /** IPFS config */
  config?: any;
}

/**
 * Sidetree IPFS request handler class
 */
export default class RequestHandler {
  /**
   * Instance of IpfsStorage.
   */
  public ipfsStorage: IpfsStorage;

  public constructor (ipfsOptions: Options) {
    this.ipfsStorage = IpfsStorage.create(ipfsOptions);
  }
  /**
   * Handles read request
   * @param base64urlEncodedMultihash Content Identifier Hash.
   * @param requestTimeoutInSeconds Timeout for fetch request.
   */
  public async handleFetchRequest (base64urlEncodedMultihash: string, requestTimeoutInSeconds: number): Promise<Response> {
    console.log(`Fetching '${base64urlEncodedMultihash}'...`);

    const multihashBuffer = base64url.toBuffer(base64urlEncodedMultihash);
    let response: Response;
    try {
      multihashes.validate(multihashBuffer);
    } catch {
      return {
        status: ResponseStatus.BadRequest,
        body: { error: 'Invalid content Hash' }
      };
      console.error(`Invalid content hash '${base64urlEncodedMultihash}'.`);
    }

    try {
      const base58EncodedMultihashString = multihashes.toB58String(multihashBuffer);
      const fetchPromsie = this.ipfsStorage.read(base58EncodedMultihashString);

      const result = await Timeout.timeout(fetchPromsie, requestTimeoutInSeconds * 1000);

      if (result instanceof Error) {
        response = {
          status: ResponseStatus.NotFound
        };
        console.warn(`'${base64urlEncodedMultihash}' not found on IPFS.`);
      } else {
        response = {
          status: ResponseStatus.Succeeded,
          body: result
        };
        console.log(`Fetched '${base64urlEncodedMultihash}'.`);
      }
    } catch (err) {
      response = {
        status: ResponseStatus.ServerError,
        body: err.message
      };
      console.error(`Error fetching '${base64urlEncodedMultihash}': ${err}`);
    }

    return response;
  }

  /**
   * Handles sidetree content write request
   * @param content Sidetree content to write into CAS storage
   */
  public async handleWriteRequest (content: Buffer): Promise<Response> {
    console.log(`Writing content of ${content.length} bytes...`);

    let response: Response;
    let base64urlEncodedMultihash;
    try {
      const base58EncodedMultihashString = await this.ipfsStorage.write(content);
      const multihashBuffer = multihashes.fromB58String(base58EncodedMultihashString);
      base64urlEncodedMultihash = base64url.encode(multihashBuffer);

      response = {
        status: ResponseStatus.Succeeded,
        body: { hash: base64urlEncodedMultihash }
      };
    } catch (err) {
      response = {
        status: ResponseStatus.ServerError,
        body: err.message
      };
      console.error(`Error writing content: ${err}`);
    }

    console.error(`Wrote content '${base64urlEncodedMultihash}'.`);
    return response;
  }
}
