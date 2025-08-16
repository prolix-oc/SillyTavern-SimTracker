const get_extension_directory = () => {
  const index_path = new URL(import.meta.url).pathname;
  // Remove the filename and the last directory to get the extension directory
  const pathParts = index_path.split("/");
  pathParts.pop(); // Remove filename
  return pathParts.join("/"); // Join the remaining parts
};

export { get_extension_directory };