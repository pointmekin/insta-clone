<template>
  <q-page class="constrain q-pa-md">
    <div class="row q-col-gutter-lg">
      <div class="col-12 col-sm-8">
        <template v-if="!loadingPosts && posts.length">
          <q-card
            class="card-post q-mb-md"
            :class="{'bg-red-1': post.offline}"
            flat
            bordered
            v-for="post in posts"
            :key="post.id"
          >
            <q-badge color="red" class="absolute-top-right badge-offline" v-if="post.offline">
              "Stored Offline"
            </q-badge>

            <q-item>
              <q-item-section avatar>
                <q-avatar>
                  <img
                    src="https://images.unsplash.com/photo-1511367461989-f85a21fda167?ixid=MXwxMjA3fDB8MHxzZWFyY2h8Mnx8cHJvZmlsZXxlbnwwfHwwfA%3D%3D&ixlib=rb-1.2.1&w=1000&q=80"
                  />
                </q-avatar>
              </q-item-section>

              <q-item-section>
                <q-item-label class="text-bold">Pointmekin</q-item-label>
                <q-item-label caption>
                  {{ post.location }}
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-separator />

            <q-img :src="post.imageUrl" />
            <q-card-section>
              <div>{{ post.caption }}</div>
              <div class="text-caption text-grey">
                {{ post.date | niceDate }}
              </div>
            </q-card-section>
          </q-card>
        </template>

        <template v-else-if="!loadingPosts || !posts.length">
          <h5 class="text-center text-grey">No posts yet</h5>
        </template>

        <template v-else>
          <q-card flat bordered>
            <q-item>
              <q-item-section avatar>
                <q-skeleton type="QAvatar" animation="fade" size="40px" />
              </q-item-section>

              <q-item-section>
                <q-item-label>
                  <q-skeleton type="text" animation="fade" />
                </q-item-label>
                <q-item-label caption>
                  <q-skeleton type="text" animation="fade" />
                </q-item-label>
              </q-item-section>
            </q-item>

            <q-skeleton height="200px" square animation="fade" />

            <q-card-section>
              <q-skeleton type="text" class="text-subtitle2" animation="fade" />
              <q-skeleton
                type="text"
                width="50%"
                class="text-subtitle2"
                animation="fade"
              />
            </q-card-section>
          </q-card>
        </template>
      </div>
      <div class="col-4 large-screen-only">
        <q-item class="fixed">
          <q-item-section avatar>
            <q-avatar size="48px">
              <img
                src="https://images.unsplash.com/photo-1511367461989-f85a21fda167?ixid=MXwxMjA3fDB8MHxzZWFyY2h8Mnx8cHJvZmlsZXxlbnwwfHwwfA%3D%3D&ixlib=rb-1.2.1&w=1000&q=80"
              />
            </q-avatar>
          </q-item-section>

          <q-item-section>
            <q-item-label class="text-bold">Pointmekin</q-item-label>
            <q-item-label caption>
              {{ "Dhanabordee M." }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </div>
    </div>
  </q-page>
</template>

<script>
import { date } from "quasar";
import { openDB } from 'idb';

export default {
  name: "PageHome",
  data() {
    return {
      posts: [],
      loadingPosts: false,
      showNoPostsYet: false
    };
  },
  filters: {
    niceDate(value) {
      return date.formatDate(value, "MMMM D, h:mmA");
    }
  },
  computed: {
    serviceWorkerSupportted: function() {
      if ('serviceWorker' in navigator) return true
      return false
    }
  },
  methods: {
    getPosts() {
      this.loadingPosts = true;
      this.$axios
        .get(`${process.env.API}/posts`)
        .then(response => {
          this.posts = response.data;
          if (!navigator.onLine) {
            this.getOfflinePosts()
          }
        })
        .catch(err => {
          this.$q.dialog({
            title: "Alert",
            message: "Could not fetch posts"
          });
          this.loadingPosts = false;
        });
      this.loadingPosts = false;
      setTimeout(() => {
        if (this.posts && this.posts.length === 0) this.showNoPostsYet = true;
      }, 500);
    },
    getOfflinePosts() {
      const db = openDB('workbox-background-sync').then(db=> {
        db.getAll('requests').then(failedRequests => {
          console.log('failed requests: ',failedRequests)
          failedRequests.forEach((failedRequest) => {
            if (failedRequest.queueName === 'createPostQueue') {
              let request = new Request(failedRequest.requestData.url, failedRequest.requestData)
              request.formData().then(formData=> {
                let offlinePost = {}
                offlinePost.id = formData.get('id')
                offlinePost.caption = formData.get('caption')
                offlinePost.location = formData.get('location')
                offlinePost.date = parseInt(formData.get('date'))
                offlinePost.offline = true

                let reader = new FileReader()
                reader.readAsDataURL(formData.get('file'))
                reader.onloadend = () => {
                  offlinePost.imageUrl = reader.result
                  this.posts.unshift(offlinePost)
                }
                
              })
            }
          })
        })
        .catch((err) => {
          console.log("Error accessing IndexDB: ", err)
        })
      })
    },
    listenForOfflinePostUploaded() {
      if (this.serviceWorkerSupportted) {
        const channel = new BroadcastChannel('sw-messages');
        channel.addEventListener('message', event => {
          console.log('Received', event.data);
          if (event.data.msg === "offline-post-uploaded") {
            let offlinePostCount = this.posts.filter(post=> post.offline === true).length
            this.posts[offlinePostCount - 1].offline = false
          }
        });
      }
      
    }
  },
  created() {
    this.listenForOfflinePostUploaded();
  },
  activated() {
    this.getPosts()
  }
};
</script>

<style lang="sass">
.card-post
  .q-img
    min-height: 200px
  .badge-offline
    border-top-left-radius: 0px !important
</style>
