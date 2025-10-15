const API_BASE_URL = __DEV__ 
  ? 'http://192.168.18.142:5000/api' 
  : 'https://your-production-api.com/api';

const SOCKET_URL = __DEV__ 
  ? 'http://192.168.18.142:5000' 
  : 'https://your-production-api.com';

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = null;
    console.log(`🔧 API Client initialized with base URL: ${this.baseURL}`);
  }

  setToken(token) {
    this.token = token;
  }
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    console.log(`📱 API Request: ${options.method || 'GET'} ${url}`); // Debug log
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (this.token) {
      config.headers.Authorization = `Bearer ${this.token}`;
    }

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      console.log(`📱 API Response: ${response.status}`, data); // Debug log

      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }

      return data;
    } catch (error) {
      //console.error(`❌ API Error for ${url}:`, error); // Enhanced error logging
      throw error;    }
  }

  // Test connectivity
  async testConnection() {
    return this.request('/test', {
      method: 'GET',
    });
  }

  // Authentication APIs
  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: userData,
    });
  }

  async login(credentials) {
    return this.request('/auth/login', {
      method: 'POST',
      body: credentials,
    });
  }

  async getProfile() {
    return this.request('/auth/me');
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST',
    });
  }

  // Baby APIs
  async createBaby(babyData) {
    return this.request('/babies', {
      method: 'POST',
      body: babyData,
    });
  }

  async getBabies() {
    return this.request('/babies');
  }

  async getBaby(babyId) {
    return this.request(`/babies/${babyId}`);
  }

  async updateBaby(babyId, babyData) {
    return this.request(`/babies/${babyId}`, {
      method: 'PUT',
      body: babyData,
    });
  }

  async deleteBaby(babyId) {
    return this.request(`/babies/${babyId}`, {
      method: 'DELETE',
    });
  }

  // Monitoring APIs
  async startMonitoring(sessionData) {
    return this.request('/monitoring/start', {
      method: 'POST',
      body: sessionData,
    });
  }

  async endMonitoring(sessionId) {
    return this.request(`/monitoring/${sessionId}/end`, {
      method: 'PUT',
    });
  }

  async getMonitoringSessions(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/monitoring/sessions?${queryString}`);
  }

  async getActiveMonitoring() {
    return this.request('/monitoring/active');
  }

  // Detection APIs
  async getDetections(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/detections?${queryString}`);
  }

  async getDetection(detectionId) {
    return this.request(`/detections/${detectionId}`);
  }

  async resolveDetection(detectionId, notes) {
    return this.request(`/detections/${detectionId}/resolve`, {
      method: 'PUT',
      body: { notes },
    });
  }

  async markFalsePositive(detectionId, reason) {
    return this.request(`/detections/${detectionId}/false-positive`, {
      method: 'PUT',
      body: { reason },
    });
  }

  // Routine APIs
  async createRoutine(routineData) {
    return this.request('/routines', {
      method: 'POST',
      body: routineData,
    });
  }

  async getRoutines(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/routines?${queryString}`);
  }

  async logRoutineEntry(entryData) {
    return this.request('/routines/entries', {
      method: 'POST',
      body: entryData,
    });
  }

  async getTodaySchedule(babyId) {
    return this.request(`/routines/today/${babyId}`);
  }

  // Community APIs
  async createPost(postData) {
    return this.request('/community/posts', {
      method: 'POST',
      body: postData,
    });
  }

  async getPosts(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/community/posts?${queryString}`);
  }

  async getPost(postId) {
    return this.request(`/community/posts/${postId}`);
  }

  async likePost(postId) {
    return this.request(`/community/posts/${postId}/like`, {
      method: 'PUT',
    });
  }

  async addComment(postId, content) {
    return this.request(`/community/posts/${postId}/comments`, {
      method: 'POST',
      body: { content },
    });
  }

  async getCategories() {
    return this.request('/community/categories');
  }

  // User APIs
  async updateProfile(profileData) {
    return this.request('/users/profile', {
      method: 'PUT',
      body: profileData,
    });
  }

  async changePassword(passwordData) {
    return this.request('/users/change-password', {
      method: 'PUT',
      body: passwordData,
    });
  }

  async getDashboardStats() {
    return this.request('/users/dashboard-stats');
  }

  // Community APIs
  async getCommunityPosts(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/community/posts?${queryString}` : '/community/posts';
    return this.request(endpoint);
  }

  async createCommunityPost(postData) {
    return this.request('/community/posts', {
      method: 'POST',
      body: postData
    });
  }

  async likePost(postId) {
    return this.request(`/community/posts/${postId}/like`, {
      method: 'PUT'
    });
  }

  async addComment(postId, commentData) {
    return this.request(`/community/posts/${postId}/comments`, {
      method: 'POST',
      body: commentData
    });
  }

  async likeComment(postId, commentId) {
    return this.request(`/community/posts/${postId}/comments/${commentId}/like`, {
      method: 'PUT'
    });
  }

  async replyToComment(postId, commentId, replyData) {
    return this.request(`/community/posts/${postId}/comments/${commentId}/replies`, {
      method: 'POST',
      body: replyData
    });
  }

  async getPostDetails(postId) {
    return this.request(`/community/posts/${postId}`);
  }

  async deletePost(postId) {
    return this.request(`/community/posts/${postId}`, {
      method: 'DELETE'
    });
  }

  async togglePostComments(postId) {
    return this.request(`/community/posts/${postId}/toggle-comments`, {
      method: 'PUT'
    });
  }

  // Generic HTTP methods for flexibility
  async get(endpoint, options = {}) {
    return this.request(endpoint, {
      method: 'GET',
      ...options
    });
  }

  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: data,
      ...options
    });
  }

  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data,
      ...options
    });
  }

  async delete(endpoint, options = {}) {
    return this.request(endpoint, {
      method: 'DELETE',
      ...options
    });
  }
}

// Create singleton instance
const apiClient = new ApiClient();

export default apiClient;
export { API_BASE_URL, SOCKET_URL };
