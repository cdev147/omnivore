import {
  IntegrationService,
  RetrievedDataState,
  RetrievedResult,
} from './integration'
import axios from 'axios'
import { env } from '../../env'

interface PocketResponse {
  status: number
  complete: number
  list: {
    [key: string]: PocketItem
  }
  since: number
  search_meta: {
    search_type: string
  }
  error: string
}

interface PocketItem {
  item_id: string
  resolved_id: string
  given_url: string
  resolved_url: string
  given_title: string
  resolved_title: string
  favorite: string
  status: string
  excerpt: string
  word_count: string
  tags: {
    [key: string]: Tag
  }
  authors: {
    [key: string]: Author
  }
}

interface Tag {
  item_id: string
  tag: string
}

interface Author {
  item_id: string
  author_id: string
  name: string
}

export class PocketIntegration extends IntegrationService {
  name = 'POCKET'
  POCKET_API_URL = 'https://getpocket.com/v3'
  headers = {
    'Content-Type': 'application/json',
    'X-Accept': 'application/json',
  }

  accessToken = async (token: string): Promise<string | null> => {
    const url = `${this.POCKET_API_URL}/oauth/authorize`
    try {
      const response = await axios.post<{ access_token: string }>(
        url,
        {
          consumer_key: env.pocket.consumerKey,
          code: token,
        },
        {
          headers: this.headers,
        }
      )
      return response.data.access_token
    } catch (error) {
      console.log('error validating pocket token', error)
      return null
    }
  }

  retrievePocketData = async (
    accessToken: string,
    since: number,
    count = 100,
    offset = 0
  ): Promise<PocketResponse> => {
    const url = `${this.POCKET_API_URL}/get`
    try {
      const response = await axios.post<PocketResponse>(
        url,
        {
          consumer_key: env.pocket.consumerKey,
          access_token: accessToken,
          state: 'all',
          detailType: 'complete',
          since,
          sort: 'oldest',
          count,
          offset,
        },
        {
          headers: this.headers,
        }
      )
      console.debug('pocket data', response.data)
      return response.data
    } catch (error) {
      console.log('error retrieving pocket data', error)
      throw error
    }
  }

  retrieve = async (
    token: string,
    since = 0,
    count = 100,
    offset = 0
  ): Promise<RetrievedResult> => {
    // const syncAt = integration.syncedAt
    //   ? integration.syncedAt.getTime() / 1000
    //   : 0
    const pocketData = await this.retrievePocketData(
      token,
      since,
      count,
      offset
    )
    const pocketItems = Object.values(pocketData.list)
    const statusToState: Record<string, RetrievedDataState> = {
      '0': 'saved',
      '1': 'archived',
      '2': 'deleted',
    }
    const data = pocketItems.map((item) => ({
      url: item.given_url,
      labels: Object.values(item.tags).map((tag) => tag.tag),
      state: statusToState[item.status],
    }))
    return {
      data,
      hasMore: pocketData.complete !== 1,
    }
    // // write the list of urls to a csv file and upload it to gcs
    // // path style: imports/<uid>/<date>/<type>-<uuid>.csv
    // const dateStr = DateTime.now().toISODate()
    // const fileUuid = uuidv4()
    // const fullPath = `imports/${integration.user.id}/${dateStr}/URL_LIST-${fileUuid}.csv`
    // const data = pocketItems.map((item) => item.given_url).join('\n')
    // await uploadToBucket(fullPath, Buffer.from(data, 'utf-8'), {
    //   contentType: 'text/csv',
    // })
    // // update the integration's syncedAt
    // await getRepository(Integration).update(integration.id, {
    //   syncedAt: new Date(),
    // })
  }
}
