// Stub in-memory database for the demo project
const store = {
  users: [],
  posts: [],
};

let seq = 1;
const id = () => `${seq++}`;

export const db = {
  users: {
    findAll: () => Promise.resolve([...store.users]),
    findById: (id) => Promise.resolve(store.users.find((u) => u.id === id) ?? null),
    create: (data) => {
      const user = { id: id(), ...data, createdAt: new Date().toISOString() };
      store.users.push(user);
      return Promise.resolve(user);
    },
    delete: (id) => {
      store.users = store.users.filter((u) => u.id !== id);
      return Promise.resolve();
    },
  },
  posts: {
    findAll: () => Promise.resolve([...store.posts]),
    findByAuthor: (authorId) =>
      Promise.resolve(store.posts.filter((p) => p.authorId === authorId)),
    create: (data) => {
      const post = { id: id(), ...data, createdAt: new Date().toISOString() };
      store.posts.push(post);
      return Promise.resolve(post);
    },
  },
};
