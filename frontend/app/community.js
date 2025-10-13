import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../services/api';

export default function CommunityScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostCategory, setNewPostCategory] = useState('General');
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getCommunityPosts({ limit: 50 });
      
      if (response.success && response.data) {
        setPosts(response.data.posts || []);
      }
    } catch (error) {
      console.error('Failed to load posts:', error);
      Alert.alert('Error', 'Failed to load community posts');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const handleCreatePost = async () => {
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      Alert.alert('Error', 'Please fill in both title and content');
      return;
    }

    try {
      const postData = {
        title: newPostTitle.trim(),
        content: newPostContent.trim(),
        category: newPostCategory
      };

      const response = await apiClient.createCommunityPost(postData);
      
      if (response.success) {
        Alert.alert('Success', 'Your post has been created!');
        setNewPostTitle('');
        setNewPostContent('');
        setNewPostCategory('General');
        setShowNewPostModal(false);
        await loadPosts(); // Reload posts
      }
    } catch (error) {
      console.error('Failed to create post:', error);
      Alert.alert('Error', error.message || 'Failed to create post');
    }
  };

  const handleLikePost = async (postId) => {
    try {
      const response = await apiClient.likePost(postId);
      
      if (response.success) {
        // Update the post in local state
        setPosts(prevPosts => prevPosts.map(post => {
          if (post.id === postId || post._id === postId) {
            return {
              ...post,
              likeCount: response.data.likeCount,
              userLiked: response.data.action === 'liked'
            };
          }
          return post;
        }));
      }
    } catch (error) {
      console.error('Failed to like post:', error);
      Alert.alert('Error', 'Failed to update like');
    }
  };

  const handleCommentPost = (post) => {
    setSelectedPost(post);
    setShowCommentModal(true);
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }

    try {
      const postId = selectedPost.id || selectedPost._id;
      const response = await apiClient.addComment(postId, {
        content: newComment.trim()
      });
      
      if (response.success) {
        Alert.alert('Success', 'Comment added successfully!');
        setNewComment('');
        setShowCommentModal(false);
        await loadPosts(); // Reload posts to get updated comment count
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
      Alert.alert('Error', error.message || 'Failed to add comment');
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Sleep': return '#4D96FF';
      case 'Feeding': return '#FF6B6B';
      case 'Equipment': return '#6BCB77';
      case 'Support': return '#FFD93D';
      default: return '#9C27B0';
    }
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return `${days}d ago`;
    }
  };

  const renderPostItem = ({ item }) => {
    const postId = item.id || item._id;
    const authorName = item.author 
      ? `${item.author.firstName || ''} ${item.author.lastName || ''}`.trim() 
      : 'Anonymous';
    const authorInitials = item.author 
      ? `${item.author.firstName?.[0] || ''}${item.author.lastName?.[0] || ''}`.toUpperCase()
      : 'AN';
    
    return (
      <TouchableOpacity
        style={styles.postCard}
        onPress={() => {
          Alert.alert('Post Detail', `Open detailed view for: ${item.title}`);
        }}
      >
        <View style={styles.postHeader}>
          <View style={styles.authorInfo}>
            <View style={styles.authorAvatar}>
              <Text style={styles.authorInitials}>{authorInitials}</Text>
            </View>
            <View style={styles.postMeta}>
              <Text style={styles.authorName}>{authorName}</Text>
              <Text style={styles.postTime}>{formatTimestamp(item.createdAt || item.timestamp)}</Text>
            </View>
          </View>
          <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category) }]}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        </View>

        <Text style={styles.postTitle}>{item.title}</Text>
        <Text style={styles.postContent} numberOfLines={3}>
          {item.content}
        </Text>

        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleLikePost(postId)}
          >
            <Ionicons 
              name={item.userLiked ? "heart" : "heart-outline"} 
              size={18} 
              color={item.userLiked ? "#e74c3c" : "#666"} 
            />
            <Text style={styles.actionText}>{item.likeCount || item.likes || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleCommentPost(item)}
          >
            <Ionicons name="chatbubble-outline" size={18} color="#666" />
            <Text style={styles.actionText}>{item.commentCount || item.replies || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="share-outline" size={18} color="#666" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6a1b9a" />
        <Text style={styles.loadingText}>Loading community...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#512da8" />
        </TouchableOpacity>
        <Text style={styles.title}>Community</Text>
        <TouchableOpacity 
          style={styles.newPostButton}
          onPress={() => setShowNewPostModal(true)}
        >
          <Ionicons name="add" size={24} color="#512da8" />
        </TouchableOpacity>
      </View>

      {/* Posts List */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item._id}
        renderItem={renderPostItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#6a1b9a']}
            tintColor="#6a1b9a"
          />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* New Post Modal */}
      <Modal
        visible={showNewPostModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowNewPostModal(false)}
            >
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Post</Text>
            <TouchableOpacity onPress={handleCreatePost}>
              <Text style={styles.postButton}>Post</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <TextInput
              style={styles.titleInput}
              placeholder="Post title..."
              value={newPostTitle}
              onChangeText={setNewPostTitle}
              maxLength={100}
            />
            
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Category:</Text>
              <View style={styles.categoryPicker}>
                {['General', 'Sleep', 'Feeding', 'Health', 'Development', 'Safety', 'Products', 'Tips'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryOption,
                      newPostCategory === cat && styles.categoryOptionSelected
                    ]}
                    onPress={() => setNewPostCategory(cat)}
                  >
                    <Text style={[
                      styles.categoryOptionText,
                      newPostCategory === cat && styles.categoryOptionTextSelected
                    ]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <TextInput
              style={styles.contentInput}
              placeholder="What's on your mind?"
              value={newPostContent}
              onChangeText={setNewPostContent}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            
            <Text style={styles.characterCount}>
              {newPostContent.length}/500 characters
            </Text>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Comment Modal */}
      <Modal
        visible={showCommentModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowCommentModal(false);
                setNewComment('');
              }}
            >
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Comment</Text>
            <TouchableOpacity onPress={handleSubmitComment}>
              <Text style={styles.postButton}>Post</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {selectedPost && (
              <View style={styles.postPreview}>
                <Text style={styles.postPreviewTitle}>{selectedPost.title}</Text>
                <Text style={styles.postPreviewContent} numberOfLines={2}>
                  {selectedPost.content}
                </Text>
              </View>
            )}
            
            <TextInput
              style={styles.commentInput}
              placeholder="Write your comment..."
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={1000}
              textAlignVertical="top"
              autoFocus
            />
            
            <Text style={styles.characterCount}>
              {newComment.length}/1000 characters
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0eef8',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
  },
  newPostButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#512da8',
  },
  listContainer: {
    padding: 16,
  },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#512da8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  authorInitials: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  postMeta: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  postTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  categoryBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  postTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  postContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  actionText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  postButton: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#512da8',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 16,
  },
  pickerContainer: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  categoryPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
  },
  categoryOptionSelected: {
    backgroundColor: '#6a1b9a',
    borderColor: '#6a1b9a',
  },
  categoryOptionText: {
    fontSize: 13,
    color: '#666',
  },
  categoryOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  contentInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    textAlignVertical: 'top',
    padding: 0,
  },
  commentInput: {
    minHeight: 120,
    fontSize: 16,
    color: '#333',
    textAlignVertical: 'top',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
  },
  postPreview: {
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 16,
  },
  postPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  postPreviewContent: {
    fontSize: 12,
    color: '#666',
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 8,
  },
});
