interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  [key: string]: any; // In case you want to pass more pagination info later
}

interface ResponseOptions<T> {
  data: T;
  paginationMeta?: PaginationMeta;
  metaKey?: string; // Defaults to "pagination"
  message?: string;
  success?: boolean;
  extra?: Record<string, any>;
}

export function formatResponse<T>(options: ResponseOptions<T>) {
  const {
    data,
    paginationMeta,
    metaKey = 'pagination',
    message,
    success = true,
    extra = {},
  } = options;

  const response: Record<string, any> = {
    success,
    data,
    ...extra,
  };

  if (paginationMeta) {
    response[metaKey] = paginationMeta;
  }

  if (message) {
    response.message = message;
  }

  return response;
}
