import axios from "axios";

const API_URL = "http://localhost:5000/api/rules";

export const getRules = async (token) => {
  const response = await axios.get(API_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
};
export const toggleRule = async (ruleId) => {
  const response = await fetch(`/api/rules/toggle/${ruleId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to toggle rule");
  }

  return response.json();
};

export const deleteRule = async (id, token) => {
  const response = await axios.delete(`${API_URL}/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
};