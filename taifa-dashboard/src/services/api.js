import axios from "axios";

export const api = axios.create({
  baseURL: "http://localhost:4000/api"
});

/*
|--------------------------------------------------------------------------
| ATTACH JWT TOKEN
|--------------------------------------------------------------------------
*/

api.interceptors.request.use((config) => {

  const token =
    localStorage.getItem("token");

  if (token) {
    config.headers.Authorization =
      `Bearer ${token}`;
  }

  return config;
});
