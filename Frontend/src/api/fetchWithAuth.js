export const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  
  const headers = {
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const fetchOptions = {
    ...options,
    headers,
  };
  
  const response = await fetch(url, fetchOptions);
  
  if (response.status === 401) {
    console.warn("Unauthorized request. Token might be expired or missing.");
    // Optionally trigger a logout event here if needed
  }
  
  return response;
};
