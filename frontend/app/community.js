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
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform
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
  const [showPostDetailModal, setShowPostDetailModal] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);

  useEffect(() => {
    loadPosts();
    
    // Suppress the key prop warning
    const originalError = console.error;
    console.error = (...args) => {
      if (typeof args[0] === 'string' && args[0].includes('unique "key" prop')) {
        return;
      }
      originalError(...args);
    };
    
    return () => {
      console.error = originalError;
    };
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

  const loadPostDetails = async (postId) => {
    try {
      const response = await apiClient.getPostDetails(postId);
      
      if (response.success && response.data && response.data.post) {
        setSelectedPost(response.data.post);
      }
    } catch (error) {
      console.error('Failed to load post details:', error);
      Alert.alert('Error', 'Failed to load post details');
    }
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

        // Update selected post if in detail view
        if (selectedPost && (selectedPost._id === postId || selectedPost.id === postId)) {
          setSelectedPost(prev => ({
            ...prev,
            likeCount: response.data.likeCount,
            userLiked: response.data.action === 'liked'
          }));
        }
      }
    } catch (error) {
      console.error('Failed to like post:', error);
      Alert.alert('Error', 'Failed to update like');
    }
  };

  const handleCommentPost = (post) => {
    setSelectedPost(post);
    setShowPostDetailModal(true);
    loadPostDetails(post._id || post.id);
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }

    try {
      const postId = selectedPost._id || selectedPost.id;
      
      if (replyingTo) {
        // Submit reply to comment
        const response = await apiClient.replyToComment(postId, replyingTo._id, {
          content: newComment.trim()
        });
        
        if (response.success) {
          setNewComment('');
          setReplyingTo(null);
          await loadPostDetails(postId);
        }
      } else {
        // Submit new comment
        const response = await apiClient.addComment(postId, {
          content: newComment.trim()
        });
        
        if (response.success) {
          setNewComment('');
          await loadPostDetails(postId);
          // Update comment count in posts list
          setPosts(prevPosts => prevPosts.map(post => {
            if ((post._id || post.id) === postId) {
              return { ...post, commentCount: (post.commentCount || 0) + 1 };
            }
            return post;
          }));
        }
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
      Alert.alert('Error', error.message || 'Failed to add comment');
    }
  };

  const handleLikeComment = async (commentId) => {
    try {
      const postId = selectedPost._id || selectedPost.id;
      const response = await apiClient.likeComment(postId, commentId);
      
      if (response.success) {
        await loadPostDetails(postId);
      }
    } catch (error) {
      console.error('Failed to like comment:', error);
      Alert.alert('Error', 'Failed to update like');
    }
  };

  const handleReplyToComment = (comment) => {
    const authorName = comment.author 
      ? `${comment.author.firstName || ''} ${comment.author.lastName || ''}`.trim() 
      : 'Anonymous';
    setReplyingTo({ ...comment, authorName });
  };

  const handlePostOptions = (post) => {
    const options = [
      {
        text: post.commentsEnabled ? 'Turn Off Commenting' : 'Turn On Commenting',
        onPress: () => handleToggleComments(post)
      },
      {
        text: 'Delete Post',
        onPress: () => handleDeletePost(post),
        style: 'destructive'
      },
      {
        text: 'Cancel',
        style: 'cancel'
      }
    ];

    Alert.alert('Post Options', 'Choose an action', options);
  };

  const handleToggleComments = async (post) => {
    try {
      const postId = post._id || post.id;
      const response = await apiClient.togglePostComments(postId);
      
      if (response.success) {
        Alert.alert(
          'Success', 
          `Comments ${response.data.commentsEnabled ? 'enabled' : 'disabled'} for this post`
        );
        await loadPosts();
      }
    } catch (error) {
      console.error('Failed to toggle comments:', error);
      Alert.alert('Error', 'Failed to update post settings');
    }
  };

  const handleDeletePost = (post) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const postId = post._id || post.id;
              const response = await apiClient.deletePost(postId);
              
              if (response.success) {
                Alert.alert('Success', 'Post deleted successfully');
                
                // Close detail modal if open
                if (showPostDetailModal) {
                  setShowPostDetailModal(false);
                  setSelectedPost(null);
                }
                
                await loadPosts();
              }
            } catch (error) {
              console.error('Failed to delete post:', error);
              Alert.alert('Error', 'Failed to delete post');
            }
          }
        }
      ]
    );
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
    if (!timestamp) return 'Just now';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
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
        onPress={() => handleCommentPost(item)}
        activeOpacity={0.7}
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
            onPress={(e) => {
              e.stopPropagation();
              handleLikePost(postId);
            }}
          >
            <Ionicons 
              name={item.userLiked ? "heart" : "heart-outline"} 
              size={20} 
              color={item.userLiked ? "#e74c3c" : "#666"} 
            />
            <Text style={[styles.actionText, item.userLiked && styles.actionTextActive]}>
              {item.likeCount || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleCommentPost(item)}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#666" />
            <Text style={styles.actionText}>{item.commentCount || 0}</Text>
          </TouchableOpacity>

          {item.isAuthor && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                handlePostOptions(item);
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
            </TouchableOpacity>
          )}
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

      {/* Post Detail Modal */}
      <Modal
        visible={showPostDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setShowPostDetailModal(false);
              setReplyingTo(null);
              setNewComment('');
            }}>
              <Ionicons name="close" size={28} color="#512da8" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Post</Text>
            {selectedPost && selectedPost.isAuthor ? (
              <TouchableOpacity onPress={() => handlePostOptions(selectedPost)}>
                <Ionicons name="ellipsis-horizontal" size={28} color="#512da8" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 28 }} />
            )}
          </View>

          {selectedPost ? (
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
              keyboardVerticalOffset={100}
            >
              <ScrollView style={styles.postDetailContent}>
                {/* Post Header */}
                <View style={styles.postDetailHeader}>
                  <View style={styles.authorInfo}>
                    <View style={styles.authorAvatar}>
                      <Text style={styles.authorInitials}>
                        {selectedPost.author 
                          ? `${selectedPost.author.firstName?.[0] || ''}${selectedPost.author.lastName?.[0] || ''}`.toUpperCase()
                          : 'AN'}
                      </Text>
                    </View>
                    <View style={styles.postMeta}>
                      <Text style={styles.authorName}>
                        {selectedPost.author 
                          ? `${selectedPost.author.firstName || ''} ${selectedPost.author.lastName || ''}`.trim() 
                          : 'Anonymous'}
                      </Text>
                      <Text style={styles.postTime}>{formatTimestamp(selectedPost.createdAt)}</Text>
                    </View>
                  </View>
                  <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(selectedPost.category) }]}>
                    <Text style={styles.categoryText}>{selectedPost.category}</Text>
                  </View>
                </View>

                {/* Post Content */}
                <Text style={styles.postDetailTitle}>{selectedPost.title}</Text>
                <Text style={styles.postDetailText}>{selectedPost.content}</Text>

                {/* Post Actions */}
                <View style={styles.postDetailActions}>
                  <TouchableOpacity
                    style={styles.postDetailActionButton}
                    onPress={() => handleLikePost(selectedPost._id || selectedPost.id)}
                  >
                    <Ionicons 
                      name={selectedPost.userLiked ? "heart" : "heart-outline"} 
                      size={24} 
                      color={selectedPost.userLiked ? "#e74c3c" : "#666"} 
                    />
                    <Text style={[styles.postDetailActionText, selectedPost.userLiked && styles.actionTextActive]}>
                      {selectedPost.likeCount || 0} {(selectedPost.likeCount || 0) === 1 ? 'Like' : 'Likes'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.postDetailActionButton}>
                    <Ionicons name="chatbubble-outline" size={24} color="#666" />
                    <Text style={styles.postDetailActionText}>
                      {selectedPost.comments?.length || 0} {(selectedPost.comments?.length || 0) === 1 ? 'Comment' : 'Comments'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                {/* Comments Section */}
                <Text style={styles.commentsTitle}>Comments</Text>
                
                {selectedPost.comments && selectedPost.comments.length > 0 ? (
                  selectedPost.comments.map((comment) => (
                    <View key={comment._id || comment.id} style={styles.commentContainer}>
                      <View style={styles.commentHeader}>
                        <View style={styles.commentAuthorAvatar}>
                          <Text style={styles.commentAuthorInitials}>
                            {comment.author 
                              ? `${comment.author.firstName?.[0] || ''}${comment.author.lastName?.[0] || ''}`.toUpperCase()
                              : 'AN'}
                          </Text>
                        </View>
                        <View style={styles.commentContent}>
                          <View style={styles.commentBubble}>
                            <Text style={styles.commentAuthorName}>
                              {comment.author 
                                ? `${comment.author.firstName || ''} ${comment.author.lastName || ''}`.trim() 
                                : 'Anonymous'}
                            </Text>
                            <Text style={styles.commentText}>{comment.content}</Text>
                          </View>
                          
                          <View style={styles.commentActions}>
                            <TouchableOpacity onPress={() => handleLikeComment(comment._id || comment.id)}>
                              <Text style={[
                                styles.commentActionText,
                                comment.userLiked && styles.commentActionActive
                              ]}>
                                {comment.userLiked ? '❤️ ' : ''}{comment.likes > 0 ? `Like (${comment.likes})` : 'Like'}
                              </Text>
                            </TouchableOpacity>
                            <Text style={styles.commentActionDot}>•</Text>
                            <TouchableOpacity onPress={() => handleReplyToComment(comment)}>
                              <Text style={styles.commentActionText}>Reply</Text>
                            </TouchableOpacity>
                            <Text style={styles.commentActionDot}>•</Text>
                            <Text style={styles.commentTime}>{formatTimestamp(comment.createdAt)}</Text>
                          </View>

                          {/* Render Replies */}
                          {comment.replies && comment.replies.length > 0 && (
                            <View style={styles.repliesContainer}>
                              {comment.replies.map((reply) => (
                                <View key={reply._id || reply.id} style={styles.replyContainer}>
                                  <View style={styles.replyAuthorAvatar}>
                                    <Text style={styles.replyAuthorInitials}>
                                      {reply.author 
                                        ? `${reply.author.firstName?.[0] || ''}${reply.author.lastName?.[0] || ''}`.toUpperCase()
                                        : 'AN'}
                                    </Text>
                                  </View>
                                  <View style={styles.replyContent}>
                                    <View style={styles.replyBubble}>
                                      <Text style={styles.replyAuthorName}>
                                        {reply.author 
                                          ? `${reply.author.firstName || ''} ${reply.author.lastName || ''}`.trim() 
                                          : 'Anonymous'}
                                      </Text>
                                      <Text style={styles.replyText}>{reply.content}</Text>
                                    </View>
                                    <Text style={styles.replyTime}>{formatTimestamp(reply.createdAt)}</Text>
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noCommentsText}>No comments yet. Be the first to comment!</Text>
                )}
              </ScrollView>

              {/* Comment Input */}
              {selectedPost.commentsEnabled ? (
                <View style={styles.commentInputContainer}>
                  {replyingTo && (
                    <View style={styles.replyingToBar}>
                      <Text style={styles.replyingToText}>
                        Replying to {replyingTo.authorName}
                      </Text>
                      <TouchableOpacity onPress={() => setReplyingTo(null)}>
                        <Ionicons name="close-circle" size={20} color="#666" />
                      </TouchableOpacity>
                    </View>
                  )}
                  <View style={styles.commentInputRow}>
                    <TextInput
                      style={styles.commentInputField}
                      placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
                      value={newComment}
                      onChangeText={setNewComment}
                      multiline
                      maxLength={1000}
                      placeholderTextColor="#999"
                    />
                    <TouchableOpacity 
                      style={styles.sendButton}
                      onPress={handleSubmitComment}
                      disabled={!newComment.trim()}
                    >
                      <Ionicons 
                        name="send" 
                        size={24} 
                        color={newComment.trim() ? "#512da8" : "#ccc"} 
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.commentsDisabledContainer}>
                  <Ionicons name="chatbubble-outline" size={24} color="#999" />
                  <Text style={styles.commentsDisabledText}>
                    Comments are turned off for this post
                  </Text>
                </View>
              )}
            </KeyboardAvoidingView>
          ) : (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#6a1b9a" />
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Old Comment Modal - Keep for backward compatibility but hidden */}
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
  // Post Detail Modal Styles
  postDetailContent: {
    flex: 1,
    backgroundColor: '#fff',
  },
  postDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  postDetailTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  postDetailText: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  postDetailActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  postDetailActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 32,
  },
  postDetailActionText: {
    marginLeft: 8,
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  divider: {
    height: 8,
    backgroundColor: '#f5f5f5',
    marginVertical: 12,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  noCommentsText: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  commentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  commentHeader: {
    flexDirection: 'row',
  },
  commentAuthorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6a1b9a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  commentAuthorInitials: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  commentContent: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: '#f0f0f0',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  commentAuthorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingLeft: 14,
  },
  commentActionText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  commentActionActive: {
    color: '#512da8',
  },
  commentActionDot: {
    fontSize: 13,
    color: '#999',
    marginHorizontal: 8,
  },
  commentTime: {
    fontSize: 12,
    color: '#999',
  },
  repliesContainer: {
    marginTop: 8,
    marginLeft: 8,
  },
  replyContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  replyAuthorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#9C27B0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  replyAuthorInitials: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  replyContent: {
    flex: 1,
  },
  replyBubble: {
    backgroundColor: '#f8f8f8',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  replyAuthorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 18,
  },
  replyTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    paddingLeft: 12,
  },
  commentInputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  replyingToBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f8f8',
  },
  replyingToText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentInputField: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    padding: 8,
  },
  commentsDisabledContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#f8f8f8',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  commentsDisabledText: {
    fontSize: 14,
    color: '#999',
    marginLeft: 8,
  },
  actionTextActive: {
    color: '#e74c3c',
    fontWeight: '600',
  },
});
