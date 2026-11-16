export interface XtreamUserInfo {
  username?: string;
  password?: string;
  message?: string;
  auth?: number;
  status?: string;
  exp_date?: string | number;
  active_cons?: string;
  max_connections?: string;
  is_trial?: string;
  created_at?: string;
}

export interface XtreamServerInfo {
  url?: string;
  port?: string;
  https_port?: string;
  server_protocol?: string;
  timezone?: string;
  hls_proxy?: number;
  audio_transcode?: number;
}

export interface XtreamAuthResponse {
  user_info?: XtreamUserInfo;
  server_info?: XtreamServerInfo;
  /** Opaque web-player session (no password in stream URLs) */
  player_session?: string;
}

export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id?: number;
}

export interface XtreamLiveStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id?: string;
  added?: string;
  category_id: string;
  custom_sid?: string;
  tv_archive?: number;
  direct_source?: string;
  tv_archive_duration?: number;
}

export interface XtreamEpgListing {
  id?: string;
  epg_id?: string;
  title: string;
  lang?: string;
  start: string;
  end: string;
  description?: string;
  channel_id?: string;
  start_timestamp?: string;
  stop_timestamp?: string;
  now_playing?: number;
  has_archive?: number;
}

/** Odpowiedź get_short_epg / get_simple_data_table (z metadanymi strefy). */
export interface XtreamEpgApiResponse {
  epg_listings?: XtreamEpgListing[];
  applied_shift_hours?: number;
  applied_shift_manual_hours?: number;
  applied_shift_auto_hours?: number;
  source_timezone?: string;
  viewer_timezone?: string;
  viewer_timezone_source?: string;
}

export interface XtreamVodStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  rating?: string;
  category_id: string;
  container_extension?: string;
  added?: string;
}

export interface XtreamSeries {
  num: number;
  name: string;
  series_id: number;
  cover: string;
  plot?: string;
  category_id: string;
  last_modified?: string;
}

export interface XtreamSeriesInfo {
  info?: {
    name?: string;
    cover?: string;
    plot?: string;
    category_id?: string;
  };
  episodes?: Record<string, XtreamEpisode[]>;
}

export interface XtreamEpisode {
  id: string;
  episode_num: number;
  title: string;
  container_extension?: string;
  info?: { movie_image?: string; plot?: string };
}

export type PlayerTab = 'live' | 'epg' | 'favorites' | 'vod' | 'series';
